/**
 * Lazy, CDN-loaded AI runtimes. Nothing here enters the main bundle —
 * transformers.js / tesseract.js are imported on first use only, and
 * models are fetched from Hugging Face / tesseract CDN at runtime.
 */

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5';
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';

type AnyPipe = (input: unknown, options?: Record<string, unknown>) => Promise<any>;

let transformersPromise: Promise<any> | null = null;
const pipeCache = new Map<string, AnyPipe>();

async function getTransformers(): Promise<any> {
  transformersPromise ??= (async () => {
    const mod = await import(/* @vite-ignore */ TRANSFORMERS_URL);
    mod.env.allowLocalModels = false;
    return mod;
  })();
  return transformersPromise;
}

async function getPipeline(task: string, model: string): Promise<AnyPipe> {
  const key = `${task}/${model}`;
  if (!pipeCache.has(key)) {
    const { pipeline } = await getTransformers();
    const pipe = await pipeline(task, model);
    pipeCache.set(key, pipe as AnyPipe);
  }
  return pipeCache.get(key)!;
}

// ---------------------------------------------------------------------------
// Speech recognition (Whisper)
// ---------------------------------------------------------------------------

export type WhisperModel = 'tiny' | 'base';

export const ASR_LANGS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: '自动检测语言' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

export interface TranscriptChunk {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  chunks: TranscriptChunk[];
}

/**
 * Transcribe 16 kHz mono PCM. With task='translate' Whisper translates to
 * English directly; language must then be the *source* language (or 'auto').
 */
export async function transcribe(
  pcm: Float32Array,
  opts: { model: WhisperModel; language?: string; task?: 'transcribe' | 'translate' },
): Promise<TranscriptResult> {
  const pipe = await getPipeline('automatic-speech-recognition', `Xenova/whisper-${opts.model}`);
  const callOpts: Record<string, unknown> = {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  };
  if (opts.language && opts.language !== 'auto') callOpts.language = opts.language;
  if (opts.task === 'translate') callOpts.task = 'translate';
  const out = await pipe(pcm, callOpts);
  const chunks: TranscriptChunk[] = (out.chunks ?? []).map((c: any) => ({
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? (c.timestamp?.[0] ?? 0) + 3,
    text: String(c.text ?? '').trim(),
  })).filter((c: TranscriptChunk) => c.text.length > 0);
  return { text: String(out.text ?? '').trim(), chunks };
}

// ---------------------------------------------------------------------------
// Text translation (opus-mt, pivots through English for zh targets)
// ---------------------------------------------------------------------------

export type TrLang = 'zh' | 'en' | 'ja' | 'ko';

export const TR_LANGS: Array<{ value: TrLang; label: string }> = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

const DIRECT_MODELS: Record<string, string> = {
  'zh>en': 'Xenova/opus-mt-zh-en',
  'en>zh': 'Xenova/opus-mt-en-zh',
  'ja>en': 'Xenova/opus-mt-ja-en',
  'ko>en': 'Xenova/opus-mt-ko-en',
};

async function translateDirect(texts: string[], src: TrLang, tgt: TrLang): Promise<string[]> {
  const pipe = await getPipeline('translation', DIRECT_MODELS[`${src}>${tgt}`]);
  const out = await pipe(texts, { max_new_tokens: 512 });
  const arr = Array.isArray(out) ? out : [out];
  return arr.map((o: any) => String(o.translation_text ?? o).trim());
}

/** Translate an array of strings; empty strings pass through untouched. */
export async function translateTexts(
  texts: string[],
  src: TrLang,
  tgt: TrLang,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  if (src === tgt) return [...texts];
  const BATCH = 12;
  const work: Array<{ texts: string[]; indexes: number[] }> = [];
  // Split into batches, skipping empties.
  const nonEmpty: Array<{ i: number; t: string }> = [];
  texts.forEach((t, i) => {
    if (t.trim()) nonEmpty.push({ i, t });
  });
  for (let i = 0; i < nonEmpty.length; i += BATCH) {
    work.push({
      texts: nonEmpty.slice(i, i + BATCH).map((x) => x.t),
      indexes: nonEmpty.slice(i, i + BATCH).map((x) => x.i),
    });
  }
  const out = new Array<string>(texts.length).fill('');
  let done = 0;
  for (const batch of work) {
    let translated: string[];
    if (DIRECT_MODELS[`${src}>${tgt}`]) {
      translated = await translateDirect(batch.texts, src, tgt);
    } else {
      // No direct model — pivot through English.
      const english = await translateDirect(batch.texts, src, 'en');
      translated = await translateDirect(english, 'en', tgt);
    }
    batch.indexes.forEach((origIdx, k) => {
      out[origIdx] = translated[k] ?? '';
    });
    done += batch.texts.length;
    onProgress?.(done, nonEmpty.length);
  }
  return out;
}

/** Rough language guess for OCR sources / plain text. */
export function guessLang(text: string): TrLang {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const kana = (text.match(/[\u3040-\u30ff]/g) ?? []).length;
  const hangul = (text.match(/[\uac00-\ud7af]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (kana > 0 && kana * 20 > cjk) return 'ja';
  if (hangul > 0) return 'ko';
  if (cjk > latin) return 'zh';
  return 'en';
}

// ---------------------------------------------------------------------------
// OCR (tesseract.js)
// ---------------------------------------------------------------------------

export const OCR_LANGS: Array<{ value: string; label: string; tr: TrLang }> = [
  { value: 'eng', label: '英语', tr: 'en' },
  { value: 'chi_sim+eng', label: '中文（简体）', tr: 'zh' },
  { value: 'jpn+eng', label: '日语', tr: 'ja' },
  { value: 'kor+eng', label: '韩语', tr: 'ko' },
];

export interface OcrLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export async function ocrLines(source: string | HTMLCanvasElement, lang: string): Promise<OcrLine[]> {
  const mod: any = await import(/* @vite-ignore */ TESSERACT_URL);
  const Tesseract = (mod.default ?? mod) as any;
  const result = await Tesseract.recognize(source, lang, {}, { blocks: true });
  const data = result?.data ?? {};
  const lines: OcrLine[] = [];
  const pushLine = (line: any) => {
    const text = String(line?.text ?? '').trim();
    const bbox = line?.bbox;
    if (text && bbox && bbox.x1 > bbox.x0 && bbox.y1 > bbox.y0) {
      lines.push({ text, bbox: { x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 } });
    }
  };
  if (Array.isArray(data.blocks)) {
    for (const block of data.blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) pushLine(line);
      }
    }
  }
  if (lines.length === 0 && data.text && data.text.trim()) {
    lines.push({ text: data.text.trim(), bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// DOCX text extraction (mammoth)
// ---------------------------------------------------------------------------

export async function extractDocxText(file: Blob): Promise<string> {
  const mod: any = await import(/* @vite-ignore */ MAMMOTH_URL);
  const mammoth = (mod.default ?? mod) as any;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return String(value ?? '');
}
