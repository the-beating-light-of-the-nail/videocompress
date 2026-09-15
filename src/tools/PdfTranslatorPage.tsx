import { useEffect, useState } from 'react';
import { unzipSync } from 'fflate';
import { pdfjsLib } from '../lib/pdfjs';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import { PDF_TRANSLATOR } from '../tools/nav';
import { formatBytes } from '../lib/format';
import { extractDocxText, guessLang, translateTexts, TR_LANGS, type TrLang } from '../lib/ai';
import { baseName, saveText } from '../lib/dl';
import { ArrowRight, LockIcon } from '../components/Icons';

const MAX_CHUNK = 400;

function mergeLinesIntoChunks(lines: string[]): string[] {
  const chunks: string[] = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = '';
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      push();
      continue;
    }
    cur = cur ? `${cur}${/[\u4e00-\u9fff]/.test(cur.slice(-1)) ? '' : ' '}${trimmed}` : trimmed;
    if (cur.length >= MAX_CHUNK || /[。！？.!?]$/.test(trimmed)) push();
  }
  push();
  return chunks;
}

async function extractPdfParagraphs(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; s: string }>>();
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] / 3);
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str });
      rows.set(y, row);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const text = rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join(' ').trim();
      if (text) lines.push(text);
    }
    lines.push('');
  }
  return mergeLinesIntoChunks(lines);
}

async function extractEpubParagraphs(file: File): Promise<string[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buf);
  const names = Object.keys(entries).filter((n) => /\.(xhtml|html)$/i.test(n)).sort();
  const lines: string[] = [];
  const parser = new DOMParser();
  for (const name of names) {
    const html = new TextDecoder().decode(entries[name]);
    const doc = parser.parseFromString(html, 'text/html');
    const text = doc.body?.textContent ?? '';
    for (const para of text.split(/\n+/)) {
      if (para.trim()) lines.push(para.trim());
    }
    lines.push('');
  }
  return mergeLinesIntoChunks(lines);
}

async function extractParagraphs(file: File): Promise<string[]> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf' || file.type === 'application/pdf') return extractPdfParagraphs(file);
  if (ext === 'docx') {
    const text = await extractDocxText(file);
    return mergeLinesIntoChunks(text.split(/\n\s*\n|\n/));
  }
  if (ext === 'epub') return extractEpubParagraphs(file);
  const text = await file.text();
  let parts = text.split(/\n\s*\n/);
  if (parts.length <= 1) parts = text.split(/\n/);
  return mergeLinesIntoChunks(parts);
}

interface Row {
  src: string;
  dst: string;
}

export default function PdfTranslatorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<TrLang>('zh');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [srcLang, setSrcLang] = useState<TrLang>('en');

  useEffect(() => () => undefined, []);

  const accept = (f: File) => {
    const ext = (f.name.split('.').pop() ?? '').toLowerCase();
    if (!['pdf', 'docx', 'txt', 'epub'].includes(ext)) {
      setError('请选择 PDF、DOCX、TXT 或 EPUB 文件。');
      setPhase('error');
      return;
    }
    setFile(f);
    setError('');
    setRows([]);
    setPhase('idle');
    setProgress(0);
    setStatus('');
  };

  const run = async () => {
    if (!file) return;
    setPhase('working');
    setProgress(0.05);
    setError('');
    try {
      setStatus('正在解析文档…');
      const chunks = await extractParagraphs(file);
      if (chunks.length === 0) throw new Error('未能从文档中提取到文本。扫描版 PDF 暂不支持。');
      const detected = guessLang(chunks.join(' ').slice(0, 3000));
      setSrcLang(detected);
      if (detected === target) {
        setRows(chunks.map((c) => ({ src: c, dst: c })));
        setProgress(1);
        setPhase('done');
        return;
      }
      setProgress(0.15);
      setStatus('正在加载翻译模型并翻译…');
      const translated = await translateTexts(chunks, detected, target, (done, total) => {
        setProgress(0.15 + 0.8 * (done / Math.max(1, total)));
        setStatus(`翻译中 ${done}/${total} 段…`);
      });
      setRows(chunks.map((c, i) => ({ src: c, dst: translated[i] ?? '' })));
      setProgress(1);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const srcLabel = TR_LANGS.find((l) => l.value === srcLang)?.label ?? '原文';
  const tgtLabel = TR_LANGS.find((l) => l.value === target)?.label ?? '';

  const left = () => {
    if (phase === 'done' && rows.length > 0) {
      return (
        <div className="transcript-panel">
          <div className="result-top">
            <span className="title">翻译完成</span>
            <span>{rows.length} 段 · {srcLabel} → {tgtLabel}</span>
          </div>
          <div className="transcript-body">
            {rows.map((r, i) => (
              <div className="doc-row" key={i}>
                <p className="doc-src">{r.src}</p>
                <p className="doc-dst">{r.dst}</p>
              </div>
            ))}
          </div>
          <div className="result-actions" style={{ padding: 12, flexWrap: 'wrap' }}>
            <button
              className="mini-btn"
              onClick={() => saveText(rows.map((r) => r.dst).join('\n\n'), `${baseName(file?.name ?? 'doc')}.${target}.txt`)}
            >
              下载译文 TXT
            </button>
            <button
              className="mini-btn primary"
              onClick={() =>
                saveText(
                  rows.map((r) => `${r.src}\n${r.dst}`).join('\n\n'),
                  `${baseName(file?.name ?? 'doc')}.bilingual.txt`,
                )
              }
            >
              下载双语文本
            </button>
          </div>
        </div>
      );
    }
    if (!file) {
      return (
        <Dropzone
          accept=".pdf,.docx,.txt,.epub,application/pdf"
          onFiles={(fs) => accept(fs[0])}
          title="拖拽文档到这里翻译"
          hints={['支持 PDF / Word (DOCX) / TXT / EPUB', '翻译在浏览器本地完成，文档不会上传']}
          onError={setError}
        />
      );
    }
    return (
      <>
        <div className="file-card">
          <div className="file-icon">📄</div>
          <div>
            <div className="batch-name">{file.name}</div>
            <div className="batch-sub">{formatBytes(file.size)}</div>
          </div>
        </div>
        {phase === 'working' && (
          <div className="progress-overlay">
            <div className="progress-pct">{Math.round(progress * 100)}%</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="progress-status">{status}</div>
          </div>
        )}
      </>
    );
  };

  return (
    <ToolPage
      meta={PDF_TRANSLATOR}
      workspace={
        <div className="workspace">
          <div className="preview-panel preview-auto">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">翻译为</span>
                <div className="seg-row">
                  {TR_LANGS.map((l) => (
                    <button
                      key={l.value}
                      className={`seg-chip wide${target === l.value ? ' selected' : ''}`}
                      onClick={() => setTarget(l.value)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <p className="crf-caption">源语言自动识别；中英互译质量最佳，日韩语经英文中转</p>
              </div>
              <p className="crf-caption">说明：输出为逐段对照的译文与双语文本；扫描版 PDF（纯图片页面）暂不支持。</p>
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '翻译中…' : phase === 'done' ? '重新翻译' : '开始翻译'} <ArrowRight size={16} />
              </button>
              <div className="notice">
                <LockIcon size={12} /> 文档全程保留在本设备浏览器中处理
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
