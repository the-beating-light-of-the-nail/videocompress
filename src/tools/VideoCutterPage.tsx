import { useEffect, useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import Timeline from '../components/Timeline';
import { VIDEO_CUTTER } from '../tools/nav';
import { isVideoFile, probeVideo } from '../lib/media';
import { formatBytes, formatDuration } from '../lib/format';
import { cancelCompression, probeStreams, runFFmpegJob } from '../lib/ffmpegClient';
import { baseName } from '../lib/dl';
import { ArrowRight, DownloadIcon, LockIcon } from '../components/Icons';

type Mode = 'keep' | 'delete';

export default function VideoCutterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [playhead, setPlayhead] = useState(0);
  const [mode, setMode] = useState<Mode>('keep');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; bytes: number } | null>(null);
  const srcRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
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
      const [r0, r1] = range;
      const len = Math.max(0.1, r1 - r0);
      let args: string[];
      if (mode === 'keep') {
        args = [
          '-ss', r0.toFixed(2),
          '-t', len.toFixed(2),
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart',
        ];
      } else {
        setStatus('正在分析音轨…');
        const info = await probeStreams(file, file.name);
        const common = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
        if (info.hasAudio) {
          const fc =
            `[0:v]trim=0:${r0.toFixed(2)},setpts=PTS-STARTPTS[v0];` +
            `[0:a]atrim=0:${r0.toFixed(2)},asetpts=PTS-STARTPTS[a0];` +
            `[0:v]trim=${r1.toFixed(2)},setpts=PTS-STARTPTS[v1];` +
            `[0:a]atrim=${r1.toFixed(2)},asetpts=PTS-STARTPTS[a1];` +
            `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`;
          args = ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:a', 'aac', ...common];
        } else {
          const fc =
            `[0:v]trim=0:${r0.toFixed(2)},setpts=PTS-STARTPTS[v0];` +
            `[0:v]trim=${r1.toFixed(2)},setpts=PTS-STARTPTS[v1];` +
            `[v0][v1]concat=n=2:v=1:a=0[v]`;
          args = ['-filter_complex', fc, '-map', '[v]', ...common, '-an'];
        }
      }
      setStatus('正在重新编码，请保持页面打开…');
      const { files } = await runFFmpegJob({
        inputs: [{ data: file, name: `input.${file.name.split('.').pop()?.toLowerCase() ?? 'mp4'}` }],
        args,
        outputs: ['output.mp4'],
        durationSec: mode === 'keep' ? len : duration,
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

  const seek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    setPlayhead(t);
  };

  const left = () => {
    if (!file || !url) {
      return (
        <Dropzone
          accept="video/*,.mkv,.avi,.wmv,.flv,.ts,.mts,.m2ts,.mpg,.mpeg,.ogv,.mov"
          onFiles={(fs) => void accept(fs[0])}
          title="拖拽视频到这里开始剪切"
          hints={['在时间轴上选择区间，保留或删除所选片段', '本地重新编码，剪切精准、无水印']}
          sample={{ label: '试试示例视频 (1.1MB)', url: '/sample.mp4', name: 'sample-480p.mp4', type: 'video/mp4' }}
          onError={setError}
        />
      );
    }
    if (phase === 'done' && result) {
      return (
        <div className="result-overlay">
          <div className="result-top">
            <span className="title">剪切完成</span>
            <span>
              {formatBytes(file.size)} → {formatBytes(result.bytes)}
            </span>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12.5 }} onClick={() => setPhase('idle')}>
              重新调整
            </button>
          </div>
          <video className="result-video" src={result.url} controls playsInline />
          <div className="result-bottom">
            <div className="result-actions">
              <a className="download-btn" href={result.url} download={`${baseName(file.name)}-cut.mp4`}>
                <DownloadIcon size={16} /> 下载 MP4
              </a>
            </div>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="media-stage">
          <video
            ref={videoRef}
            src={url}
            controls
            playsInline
            muted
            onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
          />
          <Timeline
            duration={duration}
            range={range}
            onChange={setRange}
            playhead={playhead}
            onSeek={seek}
          />
        </div>
        <div className="preview-meta">
          <span className="name">{file.name}</span>
          <span className="sub">{formatBytes(file.size)}{duration > 0 ? ` · ${formatDuration(duration)}` : ''}</span>
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
      meta={VIDEO_CUTTER}
      workspace={
        <div className="workspace">
          <div className="preview-panel">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">剪切方式</span>
                <div className="seg-row">
                  <button className={`seg-chip wide${mode === 'keep' ? ' selected' : ''}`} onClick={() => setMode('keep')}>
                    保留所选
                  </button>
                  <button className={`seg-chip wide${mode === 'delete' ? ' selected' : ''}`} onClick={() => setMode('delete')}>
                    删除所选
                  </button>
                </div>
                <p className="crf-caption">
                  {mode === 'keep'
                    ? '导出区间内的片段'
                    : '删除区间内片段，自动拼接前后两段'}
                </p>
              </div>
              <div className="adv-grid">
                <div className="adv-field">
                  <span className="adv-label">起点（秒）</span>
                  <input
                    className="num-input"
                    type="number"
                    min={0}
                    max={range[1] - 0.1}
                    step={0.1}
                    value={range[0].toFixed(1)}
                    onChange={(e) => setRange([Math.min(Number(e.target.value) || 0, range[1] - 0.1), range[1]])}
                  />
                </div>
                <div className="adv-field">
                  <span className="adv-label">终点（秒）</span>
                  <input
                    className="num-input"
                    type="number"
                    min={range[0] + 0.1}
                    max={duration}
                    step={0.1}
                    value={range[1].toFixed(1)}
                    onChange={(e) => setRange([range[0], Math.max(Number(e.target.value) || 0, range[0] + 0.1)])}
                  />
                </div>
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
