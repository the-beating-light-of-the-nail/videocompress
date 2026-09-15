import { useEffect, useRef, useState } from 'react';
import ToolPage from '../components/ToolPage';
import Dropzone from '../components/Dropzone';
import { VIDEO_TRANSLATOR } from '../tools/nav';
import { isAudioFile, isVideoFile } from '../lib/media';
import { formatBytes } from '../lib/format';
import {
  ASR_LANGS,
  TR_LANGS,
  transcribe,
  translateTexts,
  type TranscriptChunk,
  type TrLang,
  type WhisperModel,
} from '../lib/ai';
import { runFFmpegJob } from '../lib/ffmpegClient';
import { baseName, saveText, toSrt } from '../lib/dl';
import { ArrowRight, LockIcon } from '../components/Icons';

interface Row extends TranscriptChunk {
  translation: string;
}

export default function VideoTranslatorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('auto');
  const [target, setTarget] = useState<TrLang>('zh');
  const [model, setModel] = useState<WhisperModel>('tiny');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const srcLangRef = useRef<TrLang>('en');

  useEffect(() => () => undefined, []);

  const accept = (f: File) => {
    if (!isVideoFile(f) && !isAudioFile(f)) {
      setError('请选择视频或音频文件。');
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
      setStatus('正在提取音频…');
      const { files } = await runFFmpegJob({
        inputs: [{ data: file, name: `input.${file.name.split('.').pop()?.toLowerCase() ?? 'mp4'}` }],
        args: ['-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le'],
        outputs: ['audio.wav'],
        onStatus: setStatus,
      });
      setProgress(0.15);
      const wavBlob = new Blob([files['audio.wav'] as unknown as BlobPart], { type: 'audio/wav' });
      setStatus('正在解码音频…');
      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      const decoded = await ctx.decodeAudioData(await wavBlob.arrayBuffer());
      const pcm = decoded.getChannelData(0).slice();
      void ctx.close();
      setProgress(0.25);
      setStatus(`正在加载语音识别模型（约 ${model === 'tiny' ? '40' : '80'}MB，首次需下载）…`);
      const langHint = language !== 'auto' ? language : undefined;
      const result = await transcribe(pcm, { model, language: langHint });
      if (result.chunks.length === 0) {
        throw new Error('未识别到语音内容，无法翻译。请确认视频中包含清晰人声。');
      }
      srcLangRef.current =
        language !== 'auto'
          ? (language as TrLang)
          : /[\u4e00-\u9fff]/.test(result.text)
            ? 'zh'
            : /[\u3040-\u30ff]/.test(result.text)
              ? 'ja'
              : /[\uac00-\ud7af]/.test(result.text)
                ? 'ko'
                : 'en';
      setProgress(0.45);
      setStatus('正在加载翻译模型并翻译…');
      const translated = await translateTexts(
        result.chunks.map((c) => c.text),
        srcLangRef.current,
        target,
        (done, total) => {
          setProgress(0.45 + 0.5 * (done / Math.max(1, total)));
          setStatus(`翻译中 ${done}/${total} 句…`);
        },
      );
      setRows(result.chunks.map((c, i) => ({ ...c, translation: translated[i] ?? '' })));
      setProgress(1);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const srcLabel = ASR_LANGS.find((l) => l.value === language)?.label ?? '自动';
  const tgtLabel = TR_LANGS.find((l) => l.value === target)?.label ?? '';

  const left = () => {
    if (phase === 'done' && rows.length > 0) {
      return (
        <div className="transcript-panel">
          <div className="result-top">
            <span className="title">翻译完成</span>
            <span>{rows.length} 句 · {srcLabel} → {tgtLabel}</span>
          </div>
          <div className="transcript-body">
            {rows.map((r, i) => (
              <div className="tr-row" key={i}>
                <span className="tc">{r.start.toFixed(1)}s</span>
                <div className="tr-cols">
                  <p className="tr-src">{r.text}</p>
                  <input
                    className="tr-dst"
                    value={r.translation}
                    onChange={(e) =>
                      setRows((prev) => prev.map((p, j) => (j === i ? { ...p, translation: e.target.value } : p)))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="result-actions" style={{ padding: 12, flexWrap: 'wrap' }}>
            <button
              className="mini-btn"
              onClick={() => saveText(toSrt(rows.map((r) => ({ start: r.start, end: r.end, text: r.translation }))), `${baseName(file?.name ?? 'video')}.${target}.srt`)}
            >
              译文 SRT
            </button>
            <button
              className="mini-btn"
              onClick={() => saveText(toSrt(rows.map((r) => ({ start: r.start, end: r.end, text: r.text }))), `${baseName(file?.name ?? 'video')}.src.srt`)}
            >
              原文 SRT
            </button>
            <button
              className="mini-btn primary"
              onClick={() =>
                saveText(
                  toSrt(rows.map((r) => ({ start: r.start, end: r.end, text: `${r.text}\n${r.translation}` }))),
                  `${baseName(file?.name ?? 'video')}.bilingual.srt`,
                )
              }
            >
              双语 SRT
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
          title="拖拽视频到这里翻译"
          hints={['识别视频中语音并翻译为字幕，保留原音频', '首次使用需下载 AI 模型（约 40–160MB）']}
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
      meta={VIDEO_TRANSLATOR}
      workspace={
        <div className="workspace">
          <div className="preview-panel preview-auto">{left()}</div>
          <div className="settings-panel">
            <div className="settings-body">
              <div>
                <span className="field-legend">源语言（视频语音）</span>
                <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {ASR_LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
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
                <p className="crf-caption">输出为字幕文件，原视频音频保持不变</p>
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
              </div>
              {phase === 'error' && (
                <div className="error-box"><span>{error}</span></div>
              )}
            </div>
            <div className="actions">
              <button className="start-btn" onClick={() => void run()} disabled={!file || phase === 'working'}>
                {phase === 'working' ? '翻译中…' : phase === 'done' ? '重新翻译' : '开始翻译'} <ArrowRight size={16} />
              </button>
              <div className="notice">
                <LockIcon size={12} /> 识别与翻译全程在本设备浏览器中运行
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
