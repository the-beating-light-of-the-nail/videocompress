import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// ESM build is required: @ffmpeg/ffmpeg >= 0.12.10 spawns a module worker,
// which falls back to dynamic import() of the core — the UMD build has no
// default export and fails with "failed to import ffmpeg-core.js".
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

let ff: FFmpeg | null = null;
let enginePromise: Promise<FFmpeg> | null = null;

export type EngineStatus = (s: string) => void;

/** Loads (once) the single-threaded ffmpeg.wasm core from the CDN. */
export async function loadEngine(onStatus?: EngineStatus): Promise<FFmpeg> {
  if (ff) return ff;
  if (!enginePromise) {
    enginePromise = (async () => {
      onStatus?.('正在加载处理引擎（约 31MB，仅首次需要）…');
      const instance = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      onStatus?.('引擎初始化…');
      await instance.load({ coreURL, wasmURL });
      ff = instance;
      return instance;
    })();
    enginePromise.catch(() => {
      enginePromise = null;
    });
  }
  return enginePromise;
}

let encodersCache: Set<string> | null = null;

/** Runs `ffmpeg -encoders` once and caches the available encoder names. */
export async function availableEncoders(): Promise<Set<string>> {
  if (encodersCache) return encodersCache;
  const engine = await loadEngine();
  const lines: string[] = [];
  const onLog = ({ message }: { message: string }) => lines.push(message);
  engine.on('log', onLog);
  try {
    await engine.exec(['-hide_banner', '-encoders']);
    const found = new Set<string>();
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length >= 2 && /^[A-Z.]{4,8}$/.test(cols[0])) found.add(cols[1]);
    }
    encodersCache = found;
  } catch {
    encodersCache = new Set();
  } finally {
    engine.off('log', onLog);
  }
  return encodersCache;
}

export async function detectX265(engine: FFmpeg): Promise<boolean> {
  void engine;
  return (await availableEncoders()).has('libx265');
}

// ---------------------------------------------------------------------------
// Generic job runner
// ---------------------------------------------------------------------------

export interface JobInput {
  data: Blob;
  name: string;
}

export interface JobOptions {
  inputs: JobInput[];
  /** args placed between the inputs and the outputs */
  args?: string[];
  outputs: string[];
  durationSec?: number;
  onProgress?: (ratio: number) => void;
  onLog?: (line: string) => void;
  onStatus?: EngineStatus;
}

export interface JobResult {
  files: Record<string, Uint8Array>;
  logs: string[];
}

export function safeExt(name: string, fallback: string): string {
  const m = name.match(/\.([a-z0-9]{1,5})$/i);
  return (m ? m[1] : fallback).toLowerCase().replace(/[^a-z0-9]/g, '') || fallback;
}

export async function runFFmpegJob(opts: JobOptions): Promise<JobResult> {
  const engine = await loadEngine(opts.onStatus);
  const logs: string[] = [];
  const handleLog = ({ message }: { message: string }) => {
    if (!message) return;
    logs.push(message);
    opts.onLog?.(message);
    if (opts.durationSec && opts.durationSec > 0) {
      const m = message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) {
        const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        opts.onProgress?.(Math.min(0.995, seconds / opts.durationSec));
      }
    }
  };
  const handleProgress = ({ progress }: { progress: number }) => {
    if (progress > 0) opts.onProgress?.(Math.min(0.995, progress));
  };
  engine.on('log', handleLog);
  engine.on('progress', handleProgress);
  const written: string[] = [];
  try {
    for (const input of opts.inputs) {
      await engine.writeFile(input.name, await fetchFile(input.data));
      written.push(input.name);
    }
    const cli = [
      '-hide_banner',
      ...opts.inputs.flatMap((i) => ['-i', i.name]),
      ...(opts.args ?? []),
      ...opts.outputs,
    ];
    const code = await engine.exec(cli);
    if (code !== 0) {
      const tail = logs.filter((l) => l.trim()).slice(-3).join('\n');
      throw new Error(`处理失败（退出码 ${code}）。${tail}`);
    }
    const files: Record<string, Uint8Array> = {};
    for (const out of opts.outputs) {
      const data = (await engine.readFile(out)) as Uint8Array;
      files[out] = data;
    }
    return { files, logs };
  } finally {
    engine.off('log', handleLog);
    engine.off('progress', handleProgress);
    for (const name of [...written, ...opts.outputs]) {
      try {
        await engine.deleteFile(name);
      } catch {
        /* best effort cleanup */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stream probe (uses the engine — call only when ffmpeg runs anyway)
// ---------------------------------------------------------------------------

export interface ProbeInfo {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export async function probeStreams(file: Blob, name = 'input.mp4'): Promise<ProbeInfo> {
  const engine = await loadEngine();
  const inputName = `probe.${safeExt(name, 'mp4')}`;
  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => logs.push(message);
  engine.on('log', onLog);
  try {
    await engine.writeFile(inputName, await fetchFile(file));
    try {
      await engine.exec(['-hide_banner', '-i', inputName]);
    } catch {
      /* exits non-zero because no output is specified — expected */
    }
    const text = logs.join('\n');
    const info: ProbeInfo = {
      duration: 0,
      width: 0,
      height: 0,
      hasAudio: /Stream #\d+:\d+.*: Audio:/.test(text),
      hasVideo: /Stream #\d+:\d+.*: Video:/.test(text),
    };
    const d = text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (d) info.duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
    const vLine = logs.find((l) => l.includes('Video:'));
    if (vLine) {
      const v = vLine.match(/(\d{2,5})x(\d{2,5})/);
      if (v) {
        info.width = Number(v[1]);
        info.height = Number(v[2]);
      }
    }
    return info;
  } finally {
    engine.off('log', onLog);
    try {
      await engine.deleteFile(inputName);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience API used by the video compressor workspace
// ---------------------------------------------------------------------------

export async function runCompression(opts: {
  file: File;
  args: string[];
  onProgress?: (ratio: number) => void;
  onLog?: (line: string) => void;
}): Promise<Uint8Array> {
  const inputName = `input.${safeExt(opts.file.name, 'mp4')}`;
  const { files } = await runFFmpegJob({
    inputs: [{ data: opts.file, name: inputName }],
    args: opts.args,
    outputs: ['output.mp4'],
    onProgress: opts.onProgress,
    onLog: opts.onLog,
  });
  return files['output.mp4'];
}

/** Kills the engine worker. Any in-flight job rejects with a terminate error. */
export async function cancelCompression(): Promise<void> {
  if (ff) {
    ff.terminate();
    ff = null;
    enginePromise = null;
  }
}
