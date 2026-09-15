import { useEffect, useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import { VIDEO_TO_TEXT } from '../tools/nav';
import { isAudioFile, isVideoFile } from '../lib/media';
import { formatBytes } from '../lib/format';
import { ASR_LANGS, transcribe, type TranscriptChunk, type WhisperModel } from '../lib/ai';
import { runFFmpegJob } from '../lib/ffmpegClient';
import { baseName, saveText, toSrt } from '../lib/dl';
import { ArrowRight, LockIcon } from '../components/Icons';

export default function VideoToTextPage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('auto');
  const [model, setModel] = useState<WhisperModel>('tiny');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [copied, setCopied] = useState(false);
  const srcRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    },
    [],
  );

  const accept = (f: File) => {
    if (!isVideoFile(f) && !isAudioFile(f)) {
      setError('请选择视频或音频文件。');
      setPhase('error');
      return;
    }
    setFile(f);
    setError('');
    setText('');
    setChunks([]);
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
      setStatus('正在提取音频…');
      const { files } = await runFFmpegJob({
        inputs: [{ data: file, name: `input.${file.name.split('.').pop()?.toLowerCase() ?? 'mp4'}` }],
        args: ['-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le'],
        outputs: ['audio.wav'],
        onStatus: setStatus,
      });
      setProgress(0.2);
      const wavBlob = new Blob([files['audio.wav'] as unknown as BlobPart], { type: 'audio/wav' });
      setStatus('正在解码音频…');
      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      const decoded = await ctx.decodeAudioData(await wavBlob.arrayBuffer());
      const pcm = decoded.getChannelData(0).slice();
      void ctx.close();
      setProgress(0.3);
      setStatus(`正在加载语音识别模型（${model === 'tiny' ? '约 40MB' : '约 80MB'}，首次需下载）…`);
      const result = await transcribe(pcm, { model, language });
      setProgress(0.95);
      if (!result.text && result.chunks.length === 0) {
        throw new Error('未识别到语音内容。请确认视频中包含清晰的人声，或尝试更换识别语言。');
      }
      setText(result.text);
      setChunks(result.chunks);
      setProgress(1);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const left = () => {
    if (phase === 'done') {
      return (
        <div className="transcript-panel">
          <div className="result-top">
            <span className="title">转录完成</span>
            <span>{chunks.length} 个片段 · {text.length} 字</span>
          </div>
          <div className="transcript-body">
            {chunks.map((c, i) => (
              <div className="transcript-row" key={i}>
                <span className="tc">{c.start.toFixed(1)}s</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
          <div className="result-actions" style={{ padding: 12 }}>
            <button className="mini-btn primary" onClick={() => void copy()}>
              {copied ? '已复制' : '复制全文'}
            </button>
            <button className="mini-btn" onClick={() => saveText(text, `${baseName(file?.name ?? 'transcript')}.txt`)}>
              下载 TXT
            </button>
            <button
              className="mini-btn"
              onClick={() =>
                saveText(
                  toSrt(chunks.map((c) => ({ start: c.start, end: c.end, text: c.text }))),
                  `${baseName(file?.name ?? 'transcript')}.srt`,
                )
              }
            >
              下载 SRT
            </button>
          </div>
        </div>
      );
    }
    if (!file) {
      return (
        <Dropzone
          accept="video/*,audio/*,.mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a"
          onFiles={(fs) => accept(fs[0])}
          title="拖拽视频或音频到这里转录"
          hints={['AI 语音识别在你的浏览器本地运行', '首次使用需下载识别模型（约 40–80MB）']}
          onError={setError}
        />
      );
    }
    return (
      <>
        <div className="file-card">
          <div className="file-icon">🎬</div>
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
      meta={VIDEO_TO_TEXT}
      workspace={
        <div className="workspace">
          <div className="preview-panel preview-auto">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">识别语言</span>
                <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {ASR_LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="field-legend">识别模型</span>
                <div className="seg-row">
                  <button className={`seg-chip wide${model === 'tiny' ? ' selected' : ''}`} onClick={() => setModel('tiny')}>
                    快速
                    <span className="seg-note">约 40MB</span>
                  </button>
                  <button className={`seg-chip wide${model === 'base' ? ' selected' : ''}`} onClick={() => setModel('base')}>
                    精准
                    <span className="seg-note">约 80MB</span>
                  </button>
                </div>
                <p className="crf-caption">模型经 CDN 下载后缓存，之后离线可用</p>
              </div>
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '转录中…' : phase === 'done' ? '重新转录' : '开始转录'} <ArrowRight size={16} />
              </button>
              <div className="notice">
                <LockIcon size={12} /> 识别全程在本设备浏览器中运行
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
