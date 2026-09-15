import { useEffect, useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import { CROP_VIDEO } from '../tools/nav';
import { isVideoFile, probeVideo } from '../lib/media';
import { formatBytes } from '../lib/format';
import { cancelCompression, runFFmpegJob } from '../lib/ffmpegClient';
import { baseName } from '../lib/dl';
import { ArrowRight, DownloadIcon, LockIcon } from '../components/Icons';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECTS: Array<{ id: string; label: string; ratio: number | null }> = [
  { id: 'free', label: '自由', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
];

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export default function CropVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [box, setBox] = useState<Box>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [aspectId, setAspectId] = useState('free');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; bytes: number } | null>(null);
  const srcRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; box: Box } | null>(null);

  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    },
    [],
  );

  const applyAspect = (id: string) => {
    setAspectId(id);
    const preset = ASPECTS.find((a) => a.id === id);
    if (!preset || !preset.ratio || dims.w <= 0) return;
    // Work in pixel space so the ratio is true to the output frame.
    let w = dims.w * 0.8;
    let h = w / preset.ratio;
    if (h > dims.h * 0.8) {
      h = dims.h * 0.8;
      w = h * preset.ratio;
    }
    setBox({
      x: (1 - w / dims.w) / 2,
      y: (1 - h / dims.h) / 2,
      w: w / dims.w,
      h: h / dims.h,
    });
  };

  const accept = async (f: File) => {
    if (!isVideoFile(f)) {
      setError('请选择视频文件（MP4 / MOV / MKV / WebM / AVI 等）。');
      setPhase('error');
      return;
    }
    if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    const u = URL.createObjectURL(f);
    srcRef.current = u;
    setUrl(u);
    setFile(f);
    setError('');
    setResult(null);
    setPhase('idle');
    setProgress(0);
    const meta = await probeVideo(f);
    setDims({ w: meta.width, h: meta.height });
    // Default crop: center square-ish 80%.
    const ratio = meta.width > 0 && meta.height > 0 ? meta.width / meta.height : 16 / 9;
    let w = 0.8;
    let h = (w * (meta.width || 1)) / (meta.height || 1) > 1 / 0.8 ? 0.8 * (ratio > 1 ? 1 / ratio : ratio) : 0.8;
    if (ratio < 1) {
      h = 0.8;
      w = 0.8 * ratio;
      if (w > 1) w = 1;
    }
    setBox({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;
      const rect = stage.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      const b = drag.box;
      const preset = ASPECTS.find((a) => a.id === aspectId);
      if (drag.kind === 'move') {
        setBox({
          ...b,
          x: Math.min(1 - b.w, Math.max(0, b.x + dx)),
          y: Math.min(1 - b.h, Math.max(0, b.y + dy)),
        });
      } else if (preset?.ratio && dims.w > 0) {
        // Resize locked to the preset ratio (in display space, x-fraction = pixel ratio adjusted).
        const stageRatio = rect.width / rect.height;
        const boxRatioPx = preset.ratio * (dims.h / dims.w) * stageRatio;
        let w = Math.min(1, Math.max(0.05, b.w + dx));
        let h = w * boxRatioPx;
        if (h > 1) {
          h = 1;
          w = h / boxRatioPx;
        }
        setBox({ x: b.x, y: b.y, w, h });
      } else {
        setBox({
          ...b,
          w: Math.min(1 - b.x, Math.max(0.05, b.w + dx)),
          h: Math.min(1 - b.y, Math.max(0.05, b.h + dy)),
        });
      }
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [aspectId, dims]);

  const cropPx = () => {
    if (dims.w <= 0) return { w: 0, h: 0, x: 0, y: 0 };
    return {
      w: even(box.w * dims.w),
      h: even(box.h * dims.h),
      x: even(box.x * dims.w),
      y: even(box.y * dims.h),
    };
  };

  const setPx = (key: 'w' | 'h' | 'x' | 'y', value: number) => {
    if (dims.w <= 0) return;
    const v = Math.max(0, value);
    const cur = cropPx();
    const next = { ...cur, [key]: key === 'w' || key === 'h' ? even(v) : v };
    next.w = Math.min(next.w, dims.w - next.x);
    next.h = Math.min(next.h, dims.h - next.y);
    setBox({ x: next.x / dims.w, y: next.y / dims.h, w: next.w / dims.w, h: next.h / dims.h });
    setAspectId('free');
  };

  const run = async () => {
    if (!file) return;
    setPhase('working');
    setProgress(0);
    setError('');
    try {
      const c = cropPx();
      if (c.w < 16 || c.h < 16) throw new Error('裁剪区域太小，请调整后重试。');
      const args = [
        '-vf', `crop=${c.w}:${c.h}:${c.x}:${c.y}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-movflags', '+faststart',
      ];
      setStatus('正在裁剪并重新编码…');
      const { files } = await runFFmpegJob({
        inputs: [{ data: file, name: `input.${file.name.split('.').pop()?.toLowerCase() ?? 'mp4'}` }],
        args,
        outputs: ['output.mp4'],
        onProgress: (p) => setProgress((prev) => Math.max(prev, p)),
      });
      const blob = new Blob([files['output.mp4'] as unknown as BlobPart], { type: 'video/mp4' });
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      const rUrl = URL.createObjectURL(blob);
      resultRef.current = rUrl;
      setResult({ url: rUrl, bytes: blob.size });
      setProgress(1);
      setPhase('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/terminate/i.test(msg)) {
        setPhase('idle');
        setStatus('已取消。');
      } else {
        setError(msg);
        setPhase('error');
      }
    }
  };

  const px = cropPx();

  const left = () => {
    if (!file || !url) {
      return (
        <Dropzone
          accept="video/*,.mkv,.avi,.wmv,.flv,.ts,.mts,.m2ts,.mpg,.mpeg,.ogv,.mov"
          onFiles={(fs) => void accept(fs[0])}
          title="拖拽视频到这里开始裁剪"
          hints={['拖动裁剪框选择保留的画面区域', '支持 1:1 / 16:9 / 9:16 等比例预设']}
          sample={{ label: '试试示例视频 (1.1MB)', url: '/sample.mp4', name: 'sample-480p.mp4', type: 'video/mp4' }}
          onError={setError}
        />
      );
    }
    if (phase === 'done' && result) {
      return (
        <div className="result-overlay">
          <div className="result-top">
            <span className="title">裁剪完成</span>
            <span>
              {dims.w}×{dims.h} → {px.w}×{px.h} · {formatBytes(result.bytes)}
            </span>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12.5 }} onClick={() => setPhase('idle')}>
              重新调整
            </button>
          </div>
          <video className="result-video" src={result.url} controls playsInline />
          <div className="result-bottom">
            <div className="result-actions">
              <a className="download-btn" href={result.url} download={`${baseName(file.name)}-cropped.mp4`}>
                <DownloadIcon size={16} /> 下载 MP4
              </a>
            </div>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="crop-wrap">
          <div className="crop-stage" ref={stageRef}>
            <video src={url} playsInline muted controls={false} preload="metadata" />
            <div
              className="crop-box"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                dragRef.current = { kind: 'move', startX: e.clientX, startY: e.clientY, box };
              }}
            >
              <span
                className="crop-handle"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dragRef.current = { kind: 'resize', startX: e.clientX, startY: e.clientY, box };
                }}
              />
              <span className="crop-size-tag">
                {px.w}×{px.h}
              </span>
            </div>
          </div>
        </div>
        <div className="preview-meta">
          <span className="name">{file.name}</span>
          <span className="sub">
            {formatBytes(file.size)}
            {dims.w > 0 ? ` · ${dims.w}×${dims.h}` : ''}
          </span>
          <button className="change" onClick={() => { setFile(null); setUrl(null); setPhase('idle'); }}>
            更换文件
          </button>
        </div>
        {phase === 'working' && (
          <div className="progress-overlay">
            <div className="progress-pct">{Math.round(progress * 100)}%</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="progress-status">{status}</div>
            <button className="btn btn-ghost" onClick={() => void cancelCompression()}>
              取消
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <ToolPage
      meta={CROP_VIDEO}
      workspace={
        <div className="workspace">
          <div className="preview-panel">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">画面比例</span>
                <div className="seg-row wrap">
                  {ASPECTS.map((a) => (
                    <button key={a.id} className={`seg-chip${aspectId === a.id ? ' selected' : ''}`} onClick={() => applyAspect(a.id)}>
                      {a.label}
                    </button>
                  ))}
                </div>
                <p className="crf-caption">拖动裁剪框移动位置，拖动右下角手柄调整大小</p>
              </div>
              <div className="adv-grid">
                {([['w', '宽 (px)'], ['h', '高 (px)'], ['x', 'X 偏移'], ['y', 'Y 偏移']] as const).map(([key, label]) => (
                  <div className="adv-field" key={key}>
                    <span className="adv-label">{label}</span>
                    <input
                      className="num-input"
                      type="number"
                      min={16}
                      value={px[key]}
                      onChange={(e) => setPx(key, Number(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '处理中…' : '导出视频'} <ArrowRight size={16} />
              </button>
              <div className="notice">
                <LockIcon size={12} /> 文件全程保留在本设备浏览器中处理
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
