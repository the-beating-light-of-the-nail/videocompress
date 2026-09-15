import { useEffect, useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import Timeline from '../components/Timeline';
import { VIDEO_TO_MP3 } from '../tools/nav';
import { isVideoFile, probeVideo } from '../lib/media';
import { formatBytes, formatDuration } from '../lib/format';
import { availableEncoders, cancelCompression, runFFmpegJob } from '../lib/ffmpegClient';
import { baseName } from '../lib/dl';
import { ArrowRight, DownloadIcon, LockIcon } from '../components/Icons';

type Fmt = 'mp3' | 'm4a' | 'wav';

const BITRATES = [128, 192, 320];

export default function VideoToMp3Page() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [trim, setTrim] = useState(false);
  const [bitrate, setBitrate] = useState(192);
  const [fmt, setFmt] = useState<Fmt>('mp3');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; bytes: number; ext: Fmt } | null>(null);
  const resultRef = useRef<string | null>(null);
  const srcRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    },
    [],
  );

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
    setDuration(meta.duration);
    setRange([0, meta.duration]);
  };

  const run = async () => {
    if (!file) return;
    setPhase('working');
    setProgress(0);
    setError('');
    try {
      if (fmt === 'mp3') {
        const encoders = await availableEncoders();
        if (!encoders.has('libmp3lame')) {
          throw new Error('当前引擎未包含 MP3 编码器，请改用 M4A 或 WAV 格式。');
        }
      }
      const args: string[] = [];
      if (trim) {
        args.push('-ss', range[0].toFixed(2), '-t', Math.max(0.1, range[1] - range[0]).toFixed(2));
      }
      args.push('-vn');
      let ext: Fmt = fmt;
      if (fmt === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', `${bitrate}k`);
      else if (fmt === 'm4a') args.push('-c:a', 'aac', '-b:a', `${bitrate}k`);
      else args.push('-c:a', 'pcm_s16le');
      const outputName = `output.${ext}`;
      setStatus('正在提取音频…');
      const { files } = await runFFmpegJob({
        inputs: [{ data: file, name: `input.${file.name.split('.').pop()?.toLowerCase() ?? 'mp4'}` }],
        args,
        outputs: [outputName],
        durationSec: trim ? range[1] - range[0] : duration,
        onProgress: (p) => setProgress((prev) => Math.max(prev, p)),
      });
      const data = files[outputName];
      const blob = new Blob([data as unknown as BlobPart], { type: ext === 'wav' ? 'audio/wav' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg' });
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      const rUrl = URL.createObjectURL(blob);
      resultRef.current = rUrl;
      setResult({ url: rUrl, bytes: blob.size, ext });
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

  const left = () => {
    if (!file || !url) {
      return (
        <Dropzone
          accept="video/*,.mkv,.avi,.wmv,.flv,.ts,.mts,.m2ts,.mpg,.mpeg,.ogv,.mov"
          onFiles={(fs) => void accept(fs[0])}
          title="拖拽视频文件到这里提取音频"
          hints={['支持 MP4、MOV、MKV、WebM、AVI 等 30+ 格式', '本地处理，文件不会上传到任何服务器']}
          sample={{ label: '试试示例视频 (1.1MB)', url: '/sample.mp4', name: 'sample-480p.mp4', type: 'video/mp4' }}
          onError={setError}
        />
      );
    }
    if (phase === 'done' && result) {
      return (
        <div className="result-overlay">
          <div className="result-top">
            <span className="title">转换完成</span>
            <span>
              {file.name} · {formatBytes(result.bytes)}
            </span>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12.5 }} onClick={() => setPhase('idle')}>
              重新调整
            </button>
          </div>
          <div className="result-center">
            <audio controls src={result.url} style={{ width: 'min(420px, 90%)' }} />
            <div className="result-actions">
              <a className="download-btn" href={result.url} download={`${baseName(file.name)}.${result.ext}`}>
                <DownloadIcon size={16} /> 下载 {result.ext.toUpperCase()}
              </a>
            </div>
          </div>
        </div>
      );
    }
    return (
      <>
        <video className="preview-video" src={url} controls playsInline muted />
        <div className="preview-meta">
          <span className="name">{file.name}</span>
          <span className="sub">
            {formatBytes(file.size)}
            {duration > 0 ? ` · ${formatDuration(duration)}` : ''}
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
      meta={VIDEO_TO_MP3}
      workspace={
        <div className="workspace">
          <div className="preview-panel">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">输出格式</span>
                <div className="seg-row">
                  {(['mp3', 'm4a', 'wav'] as Fmt[]).map((f) => (
                    <button key={f} className={`seg-chip${fmt === f ? ' selected' : ''}`} onClick={() => setFmt(f)}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="crf-caption">MP3 兼容性最好；M4A 体积更小；WAV 无损体积大</p>
              </div>
              {fmt !== 'wav' && (
                <div>
                  <span className="field-legend">音质（码率）</span>
                  <div className="seg-row">
                    {BITRATES.map((b) => (
                      <button key={b} className={`seg-chip${bitrate === b ? ' selected' : ''}`} onClick={() => setBitrate(b)}>
                        {b}k
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="check-row">
                  <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
                  仅截取所选区间
                </label>
                {trim && duration > 0 && (
                  <div className="trim-editor">
                    <Timeline duration={duration} range={range} onChange={setRange} />
                    <div className="trim-inputs">
                      <label>
                                        起点
                        <input
                          type="number"
                          min={0}
                          max={range[1]}
                          step={0.1}
                          value={range[0].toFixed(1)}
                          onChange={(e) => setRange([Math.min(Number(e.target.value) || 0, range[1] - 0.1), range[1]])}
                        />
                      </label>
                      <label>
                                        终点
                        <input
                          type="number"
                          min={range[0]}
                          max={duration}
                          step={0.1}
                          value={range[1].toFixed(1)}
                          onChange={(e) => setRange([range[0], Math.max(Number(e.target.value) || 0, range[0] + 0.1)])}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '转换中…' : '开始转换'} <ArrowRight size={16} />
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
