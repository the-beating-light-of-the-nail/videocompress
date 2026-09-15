import { useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import { IMAGE_COMPRESS } from '../tools/nav';
import { hasAlphaChannel, isImageFile, loadImage } from '../lib/media';
import { formatBytes } from '../lib/format';
import { baseName, saveZip } from '../lib/dl';
import { ArrowRight, LockIcon } from '../components/Icons';

type Fmt = 'auto' | 'jpeg' | 'webp' | 'png';

interface Item {
  id: number;
  file: File;
  url: string;
  w: number;
  h: number;
  status: 'pending' | 'done';
  out?: { blob: Blob; url: string; ext: string };
}

const FMT_LABEL: Record<Fmt, string> = {
  auto: '智能（推荐）',
  jpeg: 'JPG',
  webp: 'WebP',
  png: 'PNG',
};

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('编码失败'))),
      mime,
      quality,
    );
  });
}

let nextId = 1;

export default function ImageCompressPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [fmt, setFmt] = useState<Fmt>('auto');
  const [quality, setQuality] = useState(75);
  const [maxSide, setMaxSide] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const urlsRef = useRef<string[]>([]);

  const addFiles = (files: File[]) => {
    const valid = files.filter((f) => isImageFile(f));
    if (valid.length === 0) {
      setError('请选择图片文件（JPG / PNG / WebP / GIF / BMP）。');
      return;
    }
    setError('');
    const added: Item[] = valid.map((file) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      return { id: nextId++, file, url, w: 0, h: 0, status: 'pending' as const };
    });
    setItems((prev) => [...prev, ...added]);
    void Promise.all(
      added.map(async (it) => {
        try {
          const img = await loadImage(it.file);
          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, w: img.naturalWidth, h: img.naturalHeight } : p)));
        } catch {
          /* dims stay 0 */
        }
      }),
    );
  };

  const run = async () => {
    setWorking(true);
    setProgress(0);
    setError('');
    try {
      const pending = items.filter((i) => i.status === 'pending');
      let done = 0;
      for (const it of pending) {
        const img = await loadImage(it.file);
        const scale = maxSide ? Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight)) : 1;
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        let mime = 'image/jpeg';
        let ext = 'jpg';
        if (fmt === 'png') {
          mime = 'image/png';
          ext = 'png';
        } else if (fmt === 'webp') {
          mime = 'image/webp';
          ext = 'webp';
        } else if (fmt === 'jpeg') {
          mime = 'image/jpeg';
          ext = 'jpg';
        } else {
          const alpha = hasAlphaChannel(img);
          if (alpha) {
            mime = 'image/webp';
            ext = 'webp';
          } else {
            mime = 'image/jpeg';
            ext = 'jpg';
          }
        }
        const blob = await canvasToBlob(canvas, mime, quality / 100);
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        setItems((prev) =>
          prev.map((p) => (p.id === it.id ? { ...p, status: 'done', out: { blob, url, ext } } : p)),
        );
        done += 1;
        setProgress(done / pending.length);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  const doneItems = items.filter((i) => i.status === 'done' && i.out);
  const totalBefore = items.reduce((s, i) => s + i.file.size, 0);
  const totalAfter = doneItems.reduce((s, i) => s + (i.out?.blob.size ?? 0), 0);
  const hasPending = items.some((i) => i.status === 'pending');

  const preview = items.length === 0
    ? (
      <Dropzone
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif"
        multiple
        onFiles={addFiles}
        title="拖拽图片到这里开始压缩"
        hints={['支持 JPG、PNG、WebP、GIF、BMP，可批量选择', '本地处理，图片不会上传到任何服务器']}
        btnLabel="选择图片"
        onError={setError}
      />
    )
    : (
      <div className="batch-panel">
        <div className="batch-head">
          <span>
            {items.length} 张图片
            {doneItems.length > 0 && totalAfter < totalBefore && (
              <span className="batch-sum">
                {' '}
                · 共节省 {formatBytes(totalBefore - totalAfter)}
              </span>
            )}
          </span>
          <span className="batch-actions">
            {doneItems.length > 0 && (
              <button
                className="mini-btn primary"
                onClick={() =>
                  void saveZip(
                    doneItems.map((i) => ({ name: `${baseName(i.file.name)}-min.${i.out!.ext}`, blob: i.out!.blob })),
                    'images-compressed.zip',
                  )
                }
              >
                打包下载 ZIP
              </button>
            )}
            <button
              className="mini-btn"
              onClick={() => {
                setItems([]);
                setProgress(0);
              }}
            >
              清空
            </button>
          </span>
        </div>
        <Dropzone
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif"
          multiple
          onFiles={addFiles}
          title="继续添加图片"
          hints={[]}
          btnLabel="选择图片"
          className="batch-add slim"
          onError={setError}
        />
        <div className="batch-list">
          {items.map((it) => {
            const outSize = it.out?.blob.size ?? 0;
            const pct = it.status === 'done' && it.file.size > 0 ? Math.round((1 - outSize / it.file.size) * 100) : null;
            return (
              <div className="batch-item" key={it.id}>
                <img className="batch-thumb" src={it.url} alt="" />
                <div className="batch-info">
                  <div className="batch-name">{it.file.name}</div>
                  <div className="batch-sub">
                    {formatBytes(it.file.size)}
                    {it.w > 0 ? ` · ${it.w}×${it.h}` : ''}
                    {it.status === 'done' && (
                      <>
                        {' → '}
                        <strong>{formatBytes(outSize)}</strong>
                        {pct != null && pct > 0 ? `（小 ${pct}%）` : ''}
                      </>
                    )}
                  </div>
                </div>
                {it.out && (
                  <a
                    className="mini-btn primary"
                    href={it.out.url}
                    download={`${baseName(it.file.name)}-min.${it.out.ext}`}
                  >
                    下载
                  </a>
                )}
              </div>
            );
          })}
        </div>
        {working && (
          <div className="inline-progress">
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    );

  return (
    <ToolPage
      meta={IMAGE_COMPRESS}
      workspace={
        <div className="workspace workspace-single">
          <div className="preview-panel preview-auto">{preview}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">输出格式</span>
                <select className="select" value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)}>
                  {(Object.keys(FMT_LABEL) as Fmt[]).map((f) => (
                    <option key={f} value={f}>
                      {FMT_LABEL[f]}
                    </option>
                  ))}
                </select>
                <p className="crf-caption">智能模式：透明背景自动用 WebP，其余用 JPG</p>
              </div>
              {fmt !== 'png' && (
                <div>
                  <div className="size-row">
                    <span className="label">画质</span>
                    <span className="size-unit">{quality}%</span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={40}
                    max={95}
                    step={1}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                  <p className="crf-caption">{quality >= 80 ? '高质量，体积压缩适中' : quality >= 60 ? '均衡（推荐）' : '体积最小，画质有所取舍'}</p>
                </div>
              )}
              <div>
                <span className="field-legend">最长边</span>
                <select
                  className="select"
                  value={maxSide ?? ''}
                  onChange={(e) => setMaxSide(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">原始尺寸</option>
                  <option value="1080">1080px</option>
                  <option value="1920">1920px</option>
                  <option value="2560">2560px</option>
                  <option value="3840">3840px</option>
                </select>
              </div>
              {error && (
                <div className="error-box">
                  <span>{error}</span>
                </div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={working || !hasPending}>
                {working ? `压缩中 ${Math.round(progress * 100)}%` : '开始压缩'} <ArrowRight size={16} />
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
