import { useEffect, useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import Timeline from '../components/Timeline';
import { AUDIO_CUTTER } from '../tools/nav';
import { decodeWaveform, isAudioFile, isVideoFile, probeAudio } from '../lib/media';
import { formatBytes, formatDuration } from '../lib/format';
import { availableEncoders, cancelCompression, runFFmpegJob } from '../lib/ffmpegClient';
import { baseName } from '../lib/dl';
import { ArrowRight, DownloadIcon, LockIcon, PlayIcon } from '../components/Icons';

type Mode = 'keep' | 'delete';
type Fmt = 'mp3' | 'wav';
const FADES = [0, 0.5, 1, 2, 3, 5];

export default function AudioCutterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[] | undefined>();
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [playhead, setPlayhead] = useState(0);
  const [mode, setMode] = useState<Mode>('keep');
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [fmt, setFmt] = useState<Fmt>('mp3');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; bytes: number; ext: Fmt } | null>(null);
  const srcRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);
  const mediaRef = useRef<HTMLVideoElement | null>(null);

  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    },
    [],
  );

  const accept = async (f: File) => {
    if (!isAudioFile(f) && !isVideoFile(f)) {
      setError('请选择音频或视频文件（MP3 / WAV / M4A / MP4 等）。');
      setPhase('error');
      return;
    }
    if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    const u = URL.createObjectURL(f);
    srcRef.current = u;
    setUrl(u);
    setFile(f);
    setIsVideo(isVideoFile(f));
    setError('');
    setResult(null);
    setPhase('idle');
    setProgress(0);
    setPeaks(undefined);
    const dur = await probeAudio(f);
    setDuration(dur);
    setRange([0, dur]);
    void decodeWaveform(f, 320)
      .then((w) => setPeaks(w.peaks))
      .catch(() => setPeaks(undefined));
  };

  const run = async () => {
    if (!file) return;
    setPhase('working');
    setProgress(0);
    setError('');
    try {
      if (fmt === 'mp3') {
        const encoders = await availableEncoders();
        if (!encoders.has('libmp3lame')) throw new Error('当前引擎未包含 MP3 编码器，请改用 WAV 格式。');
      }
      const [r0, r1] = range;
      const len = Math.max(0.1, r1 - r0);
      const codec = fmt === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '192k'] : ['-c:a', 'pcm_s16le'];
      const outputName = `output.${fmt}`;
      let args: string[];
      if (mode === 'keep') {
        const filters: string[] = [];
        if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`);
        if (fadeOut > 0) filters.push(`afade=t=out:st=${Math.max(0, len - fadeOut).toFixed(2)}:d=${fadeOut}`);
        args = ['-ss', r0.toFixed(2), '-t', len.toFixed(2), '-vn'];
        if (filters.length > 0) args.push('-af', filters.join(','));
        args.push(...codec);
      } else {
        const total = r0 + Math.max(0, duration - r1);
        let fc = `[0:a]atrim=0:${r0.toFixed(2)},asetpts=PTS-STARTPTS[a0];[0:a]atrim=${r1.toFixed(2)},asetpts=PTS-STARTPTS[a1];[a0][a1]concat=n=2:v=0:a=1[ac]`;
        const post: string[] = [];
        if (fadeIn > 0) post.push(`afade=t=in:st=0:d=${fadeIn}`);
        if (fadeOut > 0) post.push(`afade=t=out:st=${Math.max(0, total - fadeOut).toFixed(2)}:d=${fadeOut}`);
        let mapLabel = '[ac]';
        if (post.length > 0) {
          fc += `;[ac]${post.join(',')}[aout]`;
          mapLabel = '[aout]';
        }
        args = ['-vn', '-filter_complex', fc, '-map', mapLabel, ...codec];
      }
      setStatus('正在处理音频…');
      const { files } = await runFFmpegJob({
        inputs: [{ data: file, name: `input.${file.name.split('.').pop()?.toLowerCase() ?? 'mp3'}` }],
        args,
        outputs: [outputName],
        durationSec: mode === 'keep' ? len : duration - len,
        onProgress: (p) => setProgress((prev) => Math.max(prev, p)),
      });
      const data = files[outputName];
      const blob = new Blob([data as unknown as BlobPart], { type: fmt === 'wav' ? 'audio/wav' : 'audio/mpeg' });
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      const rUrl = URL.createObjectURL(blob);
      resultRef.current = rUrl;
      setResult({ url: rUrl, bytes: blob.size, ext: fmt });
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
    if (mediaRef.current) mediaRef.current.currentTime = t;
    setPlayhead(t);
  };

  const left = () => {
    if (!file || !url) {
      return (
        <Dropzone
          accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.wma,.mp4,.mov,.mkv,.webm"
          onFiles={(fs) => void accept(fs[0])}
          title="拖拽音频或视频到这里开始剪辑"
          hints={['支持 MP3 / WAV / M4A / FLAC / OGG，也可从视频中截取音频', '本地处理，文件不会上传到任何服务器']}
          btnLabel="选择文件"
          onError={setError}
        />
      );
    }
    if (phase === 'done' && result) {
      return (
        <div className="result-overlay">
          <div className="result-top">
            <span className="title">导出完成</span>
            <span>{formatBytes(result.bytes)}</span>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12.5 }} onClick={() => setPhase('idle')}>
              重新调整
            </button>
          </div>
          <div className="result-center">
            <div className="audio-chip">
              <PlayIcon size={20} />
            </div>
            <audio controls src={result.url} style={{ width: 'min(420px, 90%)' }} />
            <div className="result-actions">
              <a className="download-btn" href={result.url} download={`${baseName(file.name)}-cut.${result.ext}`}>
                <DownloadIcon size={16} /> 下载 {result.ext.toUpperCase()}
              </a>
            </div>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="media-stage">
          {isVideo ? (
            <video
              ref={mediaRef}
              src={url}
              controls
              playsInline
              muted
              onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
            />
          ) : (
            <div className="audio-stage">
              <div className="audio-chip big"><PlayIcon size={30} /></div>
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={url}
                controls
                onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
              />
            </div>
          )}
          <Timeline
            duration={duration}
            range={range}
            onChange={setRange}
            peaks={peaks}
            playhead={playhead}
            onSeek={seek}
          />
        </div>
        <div className="preview-meta">
          <span className="name">{file.name}</span>
          <span className="sub">{formatBytes(file.size)}{duration > 0 ? ` · ${formatDuration(duration)}` : ''}</span>
          <button className="change" onClick={() => { setFile(null); setUrl(null); setPhase('idle'); setPeaks(undefined); }}>
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
      meta={AUDIO_CUTTER}
      workspace={
        <div className="workspace">
          <div className="preview-panel">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">裁剪范围</span>
                <div className="seg-row">
                  <button className={`seg-chip wide${mode === 'keep' ? ' selected' : ''}`} onClick={() => setMode('keep')}>
                    保留所选
                  </button>
                  <button className={`seg-chip wide${mode === 'delete' ? ' selected' : ''}`} onClick={() => setMode('delete')}>
                    删除所选
                  </button>
                </div>
                <p className="crf-caption">
                  所选区间 {range[0].toFixed(1)}s – {range[1].toFixed(1)}s（{(range[1] - range[0]).toFixed(1)} 秒）
                </p>
              </div>
              <div className="adv-grid">
                <div className="adv-field">
                  <span className="adv-label">淡入</span>
                  <select className="select" value={fadeIn} onChange={(e) => setFadeIn(Number(e.target.value))}>
                    {FADES.map((f) => (
                      <option key={f} value={f}>{f === 0 ? '无' : `${f} 秒`}</option>
                    ))}
                  </select>
                </div>
                <div className="adv-field">
                  <span className="adv-label">淡出</span>
                  <select className="select" value={fadeOut} onChange={(e) => setFadeOut(Number(e.target.value))}>
                    {FADES.map((f) => (
                      <option key={f} value={f}>{f === 0 ? '无' : `${f} 秒`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span className="field-legend">输出格式</span>
                <div className="seg-row">
                  {(['mp3', 'wav'] as Fmt[]).map((f) => (
                    <button key={f} className={`seg-chip wide${fmt === f ? ' selected' : ''}`} onClick={() => setFmt(f)}>
                      {f.toUpperCase()}
                      <span className="seg-note">{f === 'mp3' ? '192k' : '无损'}</span>
                    </button>
                  ))}
                </div>
              </div>
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '导出中…' : '导出'} <ArrowRight size={16} />
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
