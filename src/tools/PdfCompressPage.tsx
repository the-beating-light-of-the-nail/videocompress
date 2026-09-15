import { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from '../lib/pdfjs';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import { PDF_COMPRESS } from '../tools/nav';
import { formatBytes } from '../lib/format';
import { baseName } from '../lib/dl';
import { ArrowRight, DownloadIcon, LockIcon } from '../components/Icons';

type Level = 'light' | 'recommended' | 'strong';

const LEVELS: Record<Level, { label: string; desc: string; dpi: number; q: number }> = {
  light: { label: '高质量', desc: '接近原画质，适合打印', dpi: 150, q: 0.75 },
  recommended: { label: '推荐', desc: '屏幕阅读清晰，体积明显变小', dpi: 120, q: 0.62 },
  strong: { label: '强力压缩', desc: '体积最小，图片细节有损失', dpi: 96, q: 0.5 },
};

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('页面渲染失败'))), mime, quality);
  });
}

export default function PdfCompressPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>('recommended');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; bytes: number } | null>(null);

  useEffect(
    () => () => {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
      if (result) URL.revokeObjectURL(result.url);
    },
    [thumbUrl, result],
  );

  const accept = async (f: File) => {
    if (!/pdf$/i.test(f.name) && f.type !== 'application/pdf') {
      setError('请选择 PDF 文件。');
      setPhase('error');
      return;
    }
    setError('');
    setResult(null);
    setProgress(0);
    setPhase('idle');
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      setPageCount(doc.numPages);
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1.6, 560 / base.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
      setThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error && /password/i.test(e.message) ? '这个 PDF 设有密码保护，无法处理。' : 'PDF 读取失败，请确认文件未损坏。');
      setPhase('error');
    }
  };

  const run = async () => {
    if (!file) return;
    setPhase('working');
    setProgress(0);
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const src = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      const out = await PDFDocument.create();
      const { dpi, q } = LEVELS[level];
      for (let i = 1; i <= src.numPages; i += 1) {
        setStatus(`正在处理第 ${i} / ${src.numPages} 页…`);
        const page = await src.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: dpi / 72 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const jpg = await canvasToBlob(canvas, 'image/jpeg', q);
        const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
        const newPage = out.addPage([base.width, base.height]);
        newPage.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
        setProgress(i / src.numPages);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), bytes: blob.size };
      });
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const left = () => (
    <>
      {file && thumbUrl != null ? (
        <div className="pdf-panel">
          <div className="pdf-preview">
            <img src={thumbUrl} alt="PDF 首页预览" />
          </div>
          <div className="preview-meta">
            <span className="name">{file.name}</span>
            <span className="sub">
              {formatBytes(file.size)} · {pageCount} 页
            </span>
            <button
              className="change"
              onClick={() => {
                setFile(null);
                setThumbUrl(null);
                setPhase('idle');
              }}
            >
              更换文件
            </button>
          </div>
          {phase === 'done' && result && (
            <div className="result-overlay">
              <div className="result-top">
                <span className="title">压缩完成</span>
                <span>
                  {formatBytes(file.size)} → {formatBytes(result.bytes)}
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12.5 }}
                  onClick={() => setPhase('idle')}
                >
                  重新调整
                </button>
              </div>
              <div className="result-center">
                <div className="result-icon">PDF</div>
                <div className="compare-row">
                  <span className="lbl">原始</span>
                  <div className="track"><div className="bar before" style={{ width: '100%' }} /></div>
                  <span className="size">{formatBytes(file.size)}</span>
                </div>
                <div className="compare-row">
                  <span className="lbl">压缩后</span>
                  <div className="track">
                    <div className="bar after" style={{ width: `${Math.max(4, Math.min(100, (result.bytes / file.size) * 100))}%` }} />
                  </div>
                  <span className="size">{formatBytes(result.bytes)}</span>
                </div>
                <div className="result-actions">
                  <a className="download-btn" href={result.url} download={`${baseName(file.name)}-compressed.pdf`}>
                    <DownloadIcon size={16} /> 下载 PDF
                  </a>
                  {result.bytes < file.size && (
                    <span className="saved-chip">节省 {Math.round((1 - result.bytes / file.size) * 100)}%</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Dropzone
          accept="application/pdf,.pdf"
          onFiles={(fs) => void accept(fs[0])}
          title="拖拽 PDF 文件到这里"
          hints={['页面重新渲染压缩，屏幕阅读质量不变', '本地处理，文件不会上传到任何服务器']}
          btnLabel="选择 PDF"
          onError={setError}
        />
      )}
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

  return (
    <ToolPage
      meta={PDF_COMPRESS}
      workspace={
        <div className="workspace">
          <div className="preview-panel">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">压缩强度</span>
                <div className="seg-col">
                  {(Object.keys(LEVELS) as Level[]).map((k) => (
                    <button
                      key={k}
                      className={`seg-option${level === k ? ' selected' : ''}`}
                      onClick={() => setLevel(k)}
                    >
                      <strong>{LEVELS[k].label}</strong>
                      <span>{LEVELS[k].desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="crf-caption">页面将按所选清晰度重新渲染：图片多的 PDF 效果最明显，纯文字 PDF 压缩空间有限。</p>
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '压缩中…' : '开始压缩'} <ArrowRight size={16} />
              </button>
              <div className="notice">
                <LockIcon size={12} /> PDF 全程保留在本设备浏览器中处理
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
