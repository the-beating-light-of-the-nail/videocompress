import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildCompressArgs,
  totalBitrateKbps,
  type AdvancedSettings,
  type EncoderSpeed,
  type VideoMeta,
} from '../lib/commands';
import { cancelCompression, detectX265, loadEngine, runCompression } from '../lib/ffmpegClient';
import { formatBitrate, formatBytes, formatDuration } from '../lib/format';
import {
  ArrowDown,
  ArrowRight,
  ChevronRight,
  DoubleDown,
  DownloadIcon,
  FolderIcon,
  LockIcon,
  MinusIcon,
  PlayIcon,
  TrendDown,
  UploadCloud,
} from './Icons';

type Phase = 'choose' | 'ready' | 'working' | 'done' | 'error';

const VIDEO_EXTS = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'mts', 'm2ts', 'ogv'];
const RESOLUTIONS = [1080, 720, 480, 360];

const PRESETS = [
  { id: 'p90', ratio: 0.9, label: '90%', color: '#ef4444', Icon: DoubleDown },
  { id: 'p70', ratio: 0.7, label: '70%', color: '#f97316', Icon: TrendDown },
  { id: 'p50', ratio: 0.5, label: '50%', color: '#3b82f6', Icon: ArrowDown },
  { id: 'p30', ratio: 0.3, label: '30%', color: '#8b5cf6', Icon: MinusIcon },
] as const;

const SPEEDS: Array<{ value: EncoderSpeed; label: string }> = [
  { value: 'ultrafast', label: '非常快（默认）' },
  { value: 'veryfast', label: '较快' },
  { value: 'faster', label: '快' },
  { value: 'medium', label: '均衡（更小体积）' },
];

function crfCaption(crf: number): string {
  if (crf <= 19) return `${crf} 高质量 - 较大文件`;
  if (crf <= 21) return `${crf} 良好质量 - 中等大小（默认）`;
  if (crf <= 24) return `${crf} 较小体积 - 画质略有取舍`;
  return `${crf} 最小体积 - 明显压缩痕迹`;
}

function probeVideo(file: File): Promise<VideoMeta> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const finish = (meta: VideoMeta) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
        return;
      }
      // Chrome quirk: WebM files from MediaRecorder report Infinity until seeked.
      video.currentTime = 1e7;
      video.ondurationchange = () => {
        const d = Number.isFinite(video.duration) ? video.duration : 0;
        finish({ duration: d, width: video.videoWidth, height: video.videoHeight });
      };
    };
    video.onerror = () => finish({ duration: 0, width: 0, height: 0 });
    video.src = url;
  });
}

export default function Compressor() {
  const [phase, setPhase] = useState<Phase>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<'basic' | 'advanced'>('basic');
  const [targetBytes, setTargetBytes] = useState(0);
  const [adv, setAdv] = useState<AdvancedSettings>({
    mode: 'quality', targetBytes: 0, crf: 23, height: null, codec: 'h264', speed: 'veryfast',
  });
  const [progress, setProgress] = useState(0);
  const [statusLine, setStatusLine] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; bytes: number } | null>(null);
  const [logTail, setLogTail] = useState('');

  const logsRef = useRef<string[]>([]);
  const resultUrlRef = useRef<string | null>(null);
  const srcUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
    },
    [],
  );

  const clearResult = useCallback(() => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
  }, []);

  const acceptFile = useCallback(
    async (f: File) => {
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (!f.type.startsWith('video/') && !VIDEO_EXTS.includes(ext)) {
        setFile(null);
        setPhase('error');
        setError(`"${f.name}" 看起来不是视频文件。支持：${VIDEO_EXTS.slice(0, 8).join(' / ').toUpperCase()} 等 40+ 格式。`);
        return;
      }
      clearResult();
      if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
      const url = URL.createObjectURL(f);
      srcUrlRef.current = url;
      setSrcUrl(url);
      setError('');
      setNotes([]);
      setProgress(0);
      setLogTail('');
      logsRef.current = [];
      const t = Math.max(512 * 1024, Math.round(f.size * 0.3));
      setTargetBytes(t);
      setAdv((a) => ({ ...a, targetBytes: t }));
      setFile(f);
      setPhase('ready');
      setStatusLine('');
      setMeta(await probeVideo(f));
    },
    [clearResult],
  );

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch('/sample.mp4');
      if (!res.ok) throw new Error('sample missing');
      const blob = await res.blob();
      await acceptFile(new File([blob], 'sample-480p.mp4', { type: 'video/mp4' }));
    } catch {
      setError('示例视频加载失败，请直接选择本地文件。');
      setPhase('error');
    }
  }, [acceptFile]);

  const startCompression = useCallback(async () => {
    if (!file) return;
    setPhase('working');
    setProgress(0);
    setError('');
    setNotes([]);
    setStatusLine('正在加载压缩引擎…');
    clearResult();
    const startedAt = Date.now();
    const tick = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 500);
    const flushLogs = window.setInterval(() => {
      setLogTail(logsRef.current.slice(-2).join('\n'));
    }, 500);

    try {
      const engine = await loadEngine(setStatusLine);
      const supportsX265 = await detectX265(engine);

      const settings: AdvancedSettings =
        tab === 'basic'
          ? { mode: 'size', targetBytes: Math.max(256 * 1024, targetBytes), crf: 23, height: null, codec: 'h264', speed: 'veryfast' }
          : { ...adv, targetBytes: Math.max(256 * 1024, adv.targetBytes) };

      const built = buildCompressArgs({ meta: meta ?? { duration: 0, width: 0, height: 0 }, settings, supportsX265 });
      setNotes(built.notes);
      setStatusLine('正在压缩，请保持页面打开');

      const data = await runCompression({
        file,
        args: built.args,
        onProgress: (p) => setProgress((prev) => Math.max(prev, p)),
        onLog: (line) => {
          logsRef.current.push(line);
          const m = line.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (m && meta && meta.duration > 0) {
            const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
            setProgress((prev) => Math.max(prev, Math.min(0.995, seconds / meta.duration)));
          }
        },
      });

      const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({ url, bytes: blob.size });
      setProgress(1);
      setPhase('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/terminate/i.test(message)) {
        setPhase('ready');
        setStatusLine('已取消。');
      } else {
        setError(message);
        setPhase('error');
      }
    } finally {
      window.clearInterval(tick);
      window.clearInterval(flushLogs);
    }
  }, [file, meta, tab, targetBytes, adv, clearResult]);

  const canStart = (phase === 'ready' || phase === 'done' || phase === 'error') && !!file;
  const sizeMB = file ? file.size / 1024 / 1024 : 0;
  const targetMB = targetBytes / 1024 / 1024;
  const sliderMin = Math.max(0.3, Math.round(sizeMB * 0.04 * 10) / 10);
  const bitrateHint = tab === 'basic' && meta ? totalBitrateKbps(targetBytes, meta.duration) : null;
  const presetSelected = PRESETS.find(
    (p) => file && Math.abs(targetBytes - Math.round(file.size * (1 - p.ratio))) < file.size * 0.02,
  )?.id;

  return (
    <div className="workspace" id="compress">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mkv,.avi,.wmv,.flv,.ts,.mts,.m2ts,.mpg,.mpeg,.ogv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void acceptFile(f);
          e.target.value = '';
        }}
      />

      {/* ============ left: preview panel ============ */}
      <div className="preview-panel">
        {(!file || phase === 'choose' || (phase === 'error' && !file)) && (
          <div
            className={`dropzone${dragOver ? ' drag-over' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void acceptFile(f);
            }}
          >
            <button
              className="sample-btn"
              onClick={(e) => {
                e.stopPropagation();
                void loadSample();
              }}
            >
              <PlayIcon size={12} /> 试试示例视频 (1.1MB)
            </button>
            <div className="upload-illustration">
              <UploadCloud size={52} style={{ color: '#94a3b8' }} strokeWidth={1.5} />
            </div>
            <p className="upload-title">拖拽视频文件到这里开始处理</p>
            <p className="upload-hint">本地处理建议 500MB 以内，纯浏览器即可完成</p>
            <p className="upload-hint">支持格式：mp4、webm、mov、mkv、avi、wmv 及 30+ 其他格式</p>
            <button
              className="split-btn"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <span className="split-btn-main">
                <span className="split-btn-icon">
                  <FolderIcon size={13} />
                </span>
                选择文件
              </span>
              <span className="split-btn-div" />
              <span className="split-btn-side">
                <ChevronRight size={15} />
              </span>
            </button>
          </div>
        )}

        {file && srcUrl && phase !== 'choose' && phase !== 'done' && (
          <>
            <video className="preview-video" src={srcUrl} playsInline controls={phase === 'ready'} muted />
            <div className="preview-meta">
              <span className="name">{file.name}</span>
              <span className="sub">
                {formatBytes(file.size)}
                {meta && meta.duration > 0 ? ` · ${formatDuration(meta.duration)}` : ''}
                {meta && meta.width > 0 ? ` · ${meta.width}×${meta.height}` : ''}
              </span>
              <button
                className="change"
                onClick={() => {
                  inputRef.current?.click();
                }}
              >
                更换文件
              </button>
            </div>
          </>
        )}

        {phase === 'working' && (
          <div className="progress-overlay">
            <div className="progress-pct">{Math.round(progress * 100)}%</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="progress-status">
              {statusLine} · 已用 {formatDuration(elapsed)}
            </div>
            <div className="progress-logs">{logTail}</div>
            <button className="btn btn-ghost" onClick={cancelCompression}>
              取消
            </button>
          </div>
        )}

        {phase === 'done' && result && file && (
          <div className="result-overlay">
            <div className="result-top">
              <span className="title">压缩完成</span>
              <span>
                {formatBytes(file.size)} → {formatBytes(result.bytes)}
              </span>
              <button
                className="btn btn-ghost"
                style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12.5 }}
                onClick={() => setPhase('ready')}
              >
                重新压缩
              </button>
            </div>
            <video className="result-video" src={result.url} controls playsInline />
            <div className="result-bottom">
              <div className="compare-row">
                <span className="lbl">原始</span>
                <div className="track">
                  <div className="bar before" style={{ width: '100%' }} />
                </div>
                <span className="size">{formatBytes(file.size)}</span>
              </div>
              <div className="compare-row">
                <span className="lbl">压缩后</span>
                <div className="track">
                  <div
                    className="bar after"
                    style={{ width: `${Math.max(4, Math.min(100, (result.bytes / file.size) * 100))}%` }}
                  />
                </div>
                <span className="size">{formatBytes(result.bytes)}</span>
              </div>
              <div className="result-actions">
                <a
                  className="download-btn"
                  href={result.url}
                  download={`${file.name.replace(/\.[^.]+$/, '')}-compressed.mp4`}
                >
                  <DownloadIcon size={16} /> 下载 MP4
                </a>
                {result.bytes < file.size && (
                  <span className="saved-chip">
                    节省 {formatBytes(file.size - result.bytes)}（{Math.round((1 - result.bytes / file.size) * 100)}% 更小）
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ right: settings panel ============ */}
      <div className="settings-panel">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'basic'}
            className={`tab${tab === 'basic' ? ' active' : ''}`}
            onClick={() => setTab('basic')}
          >
            基础压缩
          </button>
          <button
            role="tab"
            aria-selected={tab === 'advanced'}
            className={`tab${tab === 'advanced' ? ' active' : ''}`}
            onClick={() => setTab('advanced')}
          >
            高级压缩
          </button>
        </div>

        <div className="settings-body">
          {tab === 'basic' ? (
            <>
              <div>
                <span className="field-legend">压缩预设</span>
                <div className="preset-grid">
                  {PRESETS.map(({ id, ratio, label, color, Icon }) => (
                    <button
                      key={id}
                      className={`preset-chip${presetSelected === id ? ' selected' : ''}`}
                      onClick={() => file && setTargetBytes(Math.max(256 * 1024, Math.round(file.size * (1 - ratio))))}
                    >
                      <span className="preset-label">
                        <Icon size={12} style={{ color }} /> {label}
                      </span>
                      <span className="preset-sub">更小</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="size-row">
                  <span className="label">压缩后大小：</span>
                  <span className="size-input-wrap">
                    <input
                      type="number"
                      className="size-input"
                      min={sliderMin}
                      step={0.5}
                      value={+targetMB.toFixed(1)}
                      onChange={(e) => setTargetBytes(Math.max(0.1, Number(e.target.value) || 0.1) * 1024 * 1024)}
                    />
                    <span className="size-unit">MB</span>
                  </span>
                </div>
                <input
                  type="range"
                  className="slider"
                  min={sliderMin}
                  max={Math.max(sliderMin + 0.5, sizeMB)}
                  step={0.1}
                  value={Math.min(targetMB, sizeMB)}
                  disabled={!file}
                  onChange={(e) => setTargetBytes(Number(e.target.value) * 1024 * 1024)}
                />
                <div className="crf-caption">
                  {bitrateHint != null && file
                    ? `目标约 ${formatBitrate(bitrateHint)} 总码率（${formatBytes(targetBytes)}）`
                    : '选择文件后可调整目标大小'}
                </div>
              </div>
            </>
          ) : (
            <div className="adv-grid">
              <div className="adv-field">
                <span className="adv-label">视频编码</span>
                <select className="select" value={adv.codec} onChange={(e) => setAdv({ ...adv, codec: e.target.value as 'h264' | 'h265' })}>
                  <option value="h264">H.264（推荐）</option>
                  <option value="h265">H.265（更小但更慢）</option>
                </select>
              </div>
              <div className="adv-field">
                <span className="adv-label">压缩方式</span>
                <select className="select" value={adv.mode} onChange={(e) => setAdv({ ...adv, mode: e.target.value as 'size' | 'quality' })}>
                  <option value="quality">按视频质量</option>
                  <option value="size">按文件大小</option>
                </select>
              </div>

              {adv.mode === 'quality' ? (
                <div className="adv-field span2">
                  <span className="adv-label">选择质量 (CRF)</span>
                  <input
                    type="range"
                    className="slider"
                    min={16}
                    max={30}
                    value={adv.crf}
                    onChange={(e) => setAdv({ ...adv, crf: Number(e.target.value) })}
                  />
                  <span className="crf-caption">{crfCaption(adv.crf)}</span>
                </div>
              ) : (
                <div className="adv-field span2">
                  <div className="size-row">
                    <span className="adv-label">压缩后大小：</span>
                    <span className="size-input-wrap">
                      <input
                        type="number"
                        className="size-input"
                        min={0.1}
                        step={0.5}
                        value={+((adv.targetBytes || 0) / 1024 / 1024).toFixed(1)}
                        onChange={(e) => setAdv({ ...adv, targetBytes: Math.max(0.1, Number(e.target.value) || 0.1) * 1024 * 1024 })}
                      />
                      <span className="size-unit">MB</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={sliderMin}
                    max={Math.max(sliderMin + 0.5, sizeMB)}
                    step={0.1}
                    value={Math.min((adv.targetBytes || 0) / 1024 / 1024, sizeMB)}
                    disabled={!file}
                    onChange={(e) => setAdv({ ...adv, targetBytes: Number(e.target.value) * 1024 * 1024 })}
                  />
                </div>
              )}

              <div className="adv-field">
                <span className="adv-label">压缩速度</span>
                <select className="select" value={adv.speed} onChange={(e) => setAdv({ ...adv, speed: e.target.value as EncoderSpeed })}>
                  {SPEEDS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="adv-field">
                <span className="adv-label">分辨率</span>
                <select
                  className="select"
                  value={adv.height ?? ''}
                  onChange={(e) => setAdv({ ...adv, height: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">原始分辨率</option>
                  {RESOLUTIONS.filter(
                    (h) => !meta || Math.min(meta.width, meta.height) <= 0 || h < Math.min(meta.width, meta.height),
                  ).map((h) => (
                    <option key={h} value={h}>
                      {h}p
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {notes.length > 0 && phase !== 'working' && (
            <ul className="note-list">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          {phase === 'error' && (
            <div className="error-box">
              <span>{error}</span>
              {logsRef.current.length > 0 && (
                <details>
                  <summary>技术详情</summary>
                  <pre>{logsRef.current.slice(-8).join('\n')}</pre>
                </details>
              )}
              {file && (
                <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12.5 }} onClick={() => setPhase('ready')}>
                  调整设置后重试
                </button>
              )}
            </div>
          )}
        </div>

        <div className="actions">
          <button className="start-btn" onClick={() => void startCompression()} disabled={!canStart}>
            {phase === 'done' ? '重新压缩' : '开始压缩'} <ArrowRight size={16} />
          </button>
          <div className="notice">
            <LockIcon size={12} /> 文件全程保留在本设备浏览器中处理，不会上传到任何服务器
          </div>
        </div>
      </div>
    </div>
  );
}
