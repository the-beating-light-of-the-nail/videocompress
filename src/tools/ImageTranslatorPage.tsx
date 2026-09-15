import { useEffect, useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import { IMAGE_TRANSLATOR } from '../tools/nav';
import { isImageFile, loadImage } from '../lib/media';
import { OCR_LANGS, TR_LANGS, ocrLines, translateTexts, type TrLang } from '../lib/ai';
import { baseName } from '../lib/dl';
import { ArrowRight, DownloadIcon, LockIcon } from '../components/Icons';

interface LineRow {
  src: string;
  dst: string;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = '';
  const isCjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text);
  const tokens = isCjk ? [...text] : text.split(/\s+/);
  for (const token of tokens) {
    const candidate = cur ? (isCjk ? `${cur}${token}` : `${cur} ${token}`) : token;
    if (ctx.measureText(candidate).width <= maxWidth || !cur) {
      cur = candidate;
    } else {
      lines.push(cur);
      cur = token;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export default function ImageTranslatorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState('chi_sim+eng');
  const [target, setTarget] = useState<TrLang>('zh');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [view, setView] = useState<'result' | 'original'>('result');
  const srcRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    },
    [],
  );

  const accept = (f: File) => {
    if (!isImageFile(f)) {
      setError('请选择图片文件（JPG / PNG / WebP / BMP）。');
      setPhase('error');
      return;
    }
    if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    const u = URL.createObjectURL(f);
    srcRef.current = u;
    setOrigUrl(u);
    setFile(f);
    setError('');
    setRows([]);
    setResultUrl(null);
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
      const img = await loadImage(file);
      setStatus('正在识别文字（首次使用需下载 OCR 模型）…');
      const ocrScale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const ocrCanvas = document.createElement('canvas');
      ocrCanvas.width = Math.round(img.naturalWidth * ocrScale);
      ocrCanvas.height = Math.round(img.naturalHeight * ocrScale);
      const octx = ocrCanvas.getContext('2d')!;
      octx.drawImage(img, 0, 0, ocrCanvas.width, ocrCanvas.height);
      const lines = await ocrLines(ocrCanvas, ocrLang);
      if (lines.length === 0) throw new Error('未识别到文字，请确认图片中包含清晰文字，或更换识别语言。');
      setProgress(0.5);
      const src = OCR_LANGS.find((o) => o.value === ocrLang)?.tr ?? 'en';
      let dstTexts: string[];
      if (src === target) {
        dstTexts = lines.map((l) => l.text);
      } else {
        setStatus('正在加载翻译模型并翻译…');
        dstTexts = await translateTexts(
          lines.map((l) => l.text),
          src,
          target,
          (done, total) => {
            setProgress(0.5 + 0.3 * (done / Math.max(1, total)));
            setStatus(`翻译中 ${done}/${total} 行…`);
          },
        );
      }
      setProgress(0.85);
      setStatus('正在生成翻译图片…');
      const outCanvas = document.createElement('canvas');
      outCanvas.width = img.naturalWidth;
      outCanvas.height = img.naturalHeight;
      const ctx = outCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const back = 1 / ocrScale;
      const rowList: LineRow[] = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const dst = dstTexts[i] ?? '';
        rowList.push({
          src: line.text,
          dst,
          bbox:
            line.bbox.x1 > line.bbox.x0
              ? {
                  x0: line.bbox.x0 * back,
                  y0: line.bbox.y0 * back,
                  x1: line.bbox.x1 * back,
                  y1: line.bbox.y1 * back,
                }
              : undefined,
        });
        if (!line.bbox || line.bbox.x1 <= line.bbox.x0) continue;
        const x = line.bbox.x0 * back;
        const y = line.bbox.y0 * back;
        const w = (line.bbox.x1 - line.bbox.x0) * back;
        const h = (line.bbox.y1 - line.bbox.y0) * back;
        if (w < 4 || h < 4) continue;
        // Sample the background colour from the box edge for a seamless patch.
        const edge = ctx.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), Math.min(outCanvas.width - Math.max(0, x - 2), w + 4), Math.min(4, h)).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let p = 0; p < edge.length; p += 4) {
          r += edge[p];
          g += edge[p + 1];
          b += edge[p + 2];
          n += 1;
        }
        r = Math.round(r / Math.max(1, n));
        g = Math.round(g / Math.max(1, n));
        b = Math.round(b / Math.max(1, n));
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        ctx.fillStyle = lum > 140 ? '#111' : '#fff';
        let fontSize = Math.max(11, Math.min(h * 0.82, 42));
        let wrapped: string[] = [];
        for (;;) {
          ctx.font = `600 ${fontSize}px ${'sans-serif'}`;
          wrapped = wrapText(ctx, dst, w);
          if (wrapped.length * fontSize * 1.15 <= h * 1.5 || fontSize <= 10) break;
          fontSize -= 2;
        }
        let ty = y + (h - wrapped.length * fontSize * 1.15) / 2 + fontSize;
        for (const wl of wrapped) {
          ctx.fillText(wl, x + 1, Math.min(ty, y + h + fontSize * 0.8));
          ty += fontSize * 1.15;
        }
      }
      setRows(rowList);
      const blob = await new Promise<Blob | null>((res) => outCanvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('图片生成失败。');
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      const u = URL.createObjectURL(blob);
      resultRef.current = u;
      setResultUrl(u);
      setView('result');
      setProgress(1);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const left = () => {
    if (phase === 'done' && resultUrl) {
      return (
        <div className="transcript-panel">
          <div className="result-top">
            <span className="title">翻译完成</span>
            <div className="seg-row" style={{ marginLeft: 'auto' }}>
              <button className={`seg-chip${view === 'result' ? ' selected' : ''}`} onClick={() => setView('result')}>
                译文
              </button>
              <button className={`seg-chip${view === 'original' ? ' selected' : ''}`} onClick={() => setView('original')}>
                原图
              </button>
            </div>
          </div>
          <div className="img-result">
            <img src={view === 'result' ? resultUrl : origUrl ?? ''} alt="翻译结果" />
          </div>
          <div className="result-actions" style={{ padding: 12, flexWrap: 'wrap' }}>
            <a className="download-btn" href={resultUrl} download={`${baseName(file?.name ?? 'image')}-translated.png`}>
              <DownloadIcon size={16} /> 下载 PNG
            </a>
          </div>
        </div>
      );
    }
    if (!file) {
      return (
        <Dropzone
          accept="image/*,.jpg,.jpeg,.png,.webp,.bmp"
          onFiles={(fs) => accept(fs[0])}
          title="拖拽图片到这里翻译"
          hints={['识别路牌、菜单、笔记、截图中的文字并翻译', '译文按原位置回填，可下载 PNG']}
          onError={setError}
        />
      );
    }
    return (
      <>
        <div className="img-preview">
          <img src={origUrl ?? ''} alt="原图" />
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
      meta={IMAGE_TRANSLATOR}
      workspace={
        <div className="workspace">
          <div className="preview-panel preview-auto">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">图中文字语言</span>
                <select className="select" value={ocrLang} onChange={(e) => setOcrLang(e.target.value)}>
                  {OCR_LANGS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
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
                <p className="crf-caption">OCR 与翻译模型均在本地运行，首次使用需下载</p>
              </div>
              {phase === 'done' && rows.length > 0 && (
                <div className="ocr-lines">
                  <span className="field-legend">识别结果</span>
                  {rows.map((r, i) => (
                    <div className="ocr-row" key={i}>
                      <span className="ocr-src">{r.src}</span>
                      <span className="ocr-dst">{r.dst}</span>
                    </div>
                  ))}
                </div>
              )}
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '翻译中…' : phase === 'done' ? '重新翻译' : '开始翻译'} <ArrowRight size={16} />
              </button>
              <div className="notice">
                <LockIcon size={12} /> 图片全程保留在本设备浏览器中处理
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
