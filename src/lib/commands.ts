export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
}

export type EncoderSpeed = 'ultrafast' | 'veryfast' | 'faster' | 'medium';

export interface AdvancedSettings {
  mode: 'size' | 'quality';
  /** Used when mode === 'size' */
  targetBytes: number;
  /** Constant rate factor, 18–34. Used when mode === 'quality' */
  crf: number;
  /** Target short-side height in pixels, null = keep original */
  height: number | null;
  codec: 'h264' | 'h265';
  /** x264/x265 preset; slower = smaller output at same quality */
  speed: EncoderSpeed;
}

export interface BuildInput {
  meta: VideoMeta;
  settings: AdvancedSettings;
  supportsX265: boolean;
}

export interface BuildResult {
  args: string[];
  notes: string[];
}

export function totalBitrateKbps(targetBytes: number, durationSec: number): number | null {
  if (durationSec <= 0) return null;
  return (targetBytes * 8) / durationSec / 1000;
}

/**
 * Builds the FFmpeg argument tail (everything after `-i input.ext`,
 * before the output name) for a single-pass MP4 re-encode.
 */
export function buildCompressArgs(input: BuildInput): BuildResult {
  const notes: string[] = [];
  const { meta, settings } = input;

  let codec = settings.codec;
  if (codec === 'h265' && !input.supportsX265) {
    codec = 'h264';
    notes.push('H.265 is not available in this engine build — fell back to H.264.');
  }
  const encoder = codec === 'h265' ? 'libx265' : 'libx264';

  const args: string[] = ['-c:v', encoder, '-preset', settings.speed, '-pix_fmt', 'yuv420p'];

  // Resolution: downscale only, preserving aspect ratio with even dimensions.
  // "720p/480p" targets the short side (height for landscape, width for portrait).
  const shorter = Math.min(meta.width, meta.height);
  if (settings.height && shorter > 0 && settings.height < shorter) {
    const portrait = meta.width < meta.height;
    args.push('-vf', portrait ? `scale=${settings.height}:-2` : `scale=-2:${settings.height}`);
  }

  if (settings.mode === 'size' && meta.duration > 0) {
    const totalKbps = totalBitrateKbps(settings.targetBytes, meta.duration) ?? 0;
    const audioKbps = totalKbps > 260 ? 128 : 64;
    let videoKbps = Math.floor(totalKbps - audioKbps);
    if (videoKbps < 48) {
      videoKbps = 48;
      notes.push('That target is very aggressive for this video length — the output may land above it.');
    }
    args.push(
      '-b:v', `${videoKbps}k`,
      '-maxrate', `${Math.round(videoKbps * 1.45)}k`,
      '-bufsize', `${videoKbps * 2}k`,
      '-c:a', 'aac', '-b:a', `${audioKbps}k`,
    );
  } else {
    if (settings.mode === 'size') {
      notes.push('The video duration could not be read — compressed by quality instead of target size.');
    }
    args.push('-crf', String(settings.crf), '-c:a', 'aac', '-b:a', '128k');
  }

  args.push('-movflags', '+faststart');
  if (encoder === 'libx265') args.push('-tag:v', 'hvc1');

  return { args, notes };
}
