import { useCallback, useEffect, useRef, useState } from 'react';
import { drawPeaks } from '../lib/media';

interface Props {
  duration: number;
  range: [number, number];
  onChange: (range: [number, number]) => void;
  peaks?: number[];
  playhead?: number;
  onSeek?: (t: number) => void;
}

const MIN_SPAN = 0.1;

export default function Timeline({ duration, range, onChange, peaks, playhead, onSeek }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const flat = peaks ?? new Array(120).fill(0.35);
    drawPeaks(canvas, flat, width, 64);
  }, [peaks, width, duration]);

  const timeAt = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return frac * duration;
    },
    [duration],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const t = timeAt(e.clientX);
      onChange([
        drag === 'start' ? Math.min(t, range[1] - MIN_SPAN) : range[0],
        drag === 'end' ? Math.max(t, range[0] + MIN_SPAN) : range[1],
      ]);
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, onChange, range, timeAt]);

  const dur = duration || 1;
  const startPct = (range[0] / dur) * 100;
  const endPct = (range[1] / dur) * 100;
  const playPct = playhead != null ? Math.min(100, Math.max(0, (playhead / dur) * 100)) : null;

  return (
    <div
      className="timeline"
      ref={wrapRef}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).dataset.handle) return;
        onSeek?.(timeAt(e.clientX));
      }}
    >
      <canvas ref={canvasRef} />
      <div className="tl-selection" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}>
        <button
          className="tl-handle"
          data-handle="start"
          aria-label="区间起点"
          onPointerDown={(e) => {
            e.preventDefault();
            setDrag('start');
          }}
        />
        <button
          className="tl-handle right"
          data-handle="end"
          aria-label="区间终点"
          onPointerDown={(e) => {
            e.preventDefault();
            setDrag('end');
          }}
        />
      </div>
      {playPct != null && <div className="tl-playhead" style={{ left: `${playPct}%` }} />}
    </div>
  );
}
