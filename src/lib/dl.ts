import { zipSync, type Zippable } from 'fflate';

export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function saveText(text: string, name: string, mime = 'text/plain;charset=utf-8'): void {
  saveBlob(new Blob([text], { type: mime }), name);
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

export function extOf(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

function srtTime(t: number): string {
  const clamped = Math.max(0, t);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function toSrt(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      const start = seg.start ?? 0;
      const end = seg.end ?? start + 2;
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(Math.max(end, start + 0.2))}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/** Zip a list of results and trigger a download (small result sets only). */
export async function saveZip(entries: ZipEntry[], zipName: string): Promise<void> {
  const zippable: Zippable = {};
  for (const entry of entries) {
    const buf = await entry.blob.arrayBuffer();
    zippable[entry.name] = new Uint8Array(buf);
  }
  const zipped = zipSync(zippable, { level: 0 });
  saveBlob(new Blob([zipped as unknown as BlobPart], { type: 'application/zip' }), zipName);
}
