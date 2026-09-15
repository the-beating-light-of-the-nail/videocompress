export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
}

const VIDEO_EXTS = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'mts', 'm2ts', 'ogv'];

export function isVideoFile(f: File): boolean {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  return f.type.startsWith('video/') || VIDEO_EXTS.includes(ext);
}

export function isAudioFile(f: File): boolean {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  return f.type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'amr'].includes(ext);
}

export function isImageFile(f: File): boolean {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  return f.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(ext);
}

/** Read duration/resolution via a detached <video> element (cheap, no wasm). */
export function probeVideo(file: File): Promise<VideoMeta> {
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

/** Read duration via a detached <audio> element. */
export function probeAudio(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const finish = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

export interface WaveformResult {
  peaks: number[];
  duration: number;
}

/** Decode a media file's audio track and reduce it to N amplitude peaks. */
export async function decodeWaveform(file: Blob, buckets = 300): Promise<WaveformResult> {
  const AudioCtx = window.AudioContext;
  const ctx = new AudioCtx();
  try {
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const channel = audio.getChannelData(0);
    const size = Math.floor(channel.length / buckets) || 1;
    const peaks: number[] = [];
    let max = 0.0001;
    for (let i = 0; i < buckets; i += 1) {
      let peak = 0;
      const startIdx = i * size;
      for (let j = 0; j < size; j += 1) {
        const v = Math.abs(channel[startIdx + j] ?? 0);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
      if (peak > max) max = peak;
    }
    return { peaks: peaks.map((p) => p / max), duration: audio.duration };
  } finally {
    void ctx.close();
  }
}

/** Decode a media file to mono 16 kHz Float32 PCM (whisper input). */
export async function decodePcm16kMono(file: Blob): Promise<Float32Array> {
  const AudioCtx = window.AudioContext;
  const ctx = new AudioCtx({ sampleRate: 16000 });
  try {
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const channel = audio.getChannelData(0);
    return channel.slice();
  } finally {
    void ctx.close();
  }
}

export function drawPeaks(canvas: HTMLCanvasElement, peaks: number[], width: number, height: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const barW = width / peaks.length;
  const mid = height / 2;
  ctx.fillStyle = 'rgba(60, 131, 246, 0.35)';
  for (let i = 0; i < peaks.length; i += 1) {
    const h = Math.max(1.5, peaks[i] * (height * 0.86));
    ctx.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 0.5), h);
  }
}

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败，请换一张图片试试。'));
    };
    img.src = url;
  });
}

export function hasAlphaChannel(img: HTMLImageElement): boolean {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 64 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

export function formatTimecode(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
}
