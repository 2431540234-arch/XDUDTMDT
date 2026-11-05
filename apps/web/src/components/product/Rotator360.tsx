'use client';

// Khung xoay 360° bằng chuỗi ảnh (tự viết, không dùng thư viện).
// - Kéo chuột/vuốt (pointer events) ~8px/frame có quán tính; ← → đổi frame, Space tự xoay, +/- zoom, Esc thoát toàn màn hình.
// - Lăn chuột / pinch để phóng to 1x–3x, kéo để di chuyển khi đã phóng to.
// - Tải trước toàn bộ frame của màu hiện tại (ưu tiên frame gần góc đang xem), cache ảnh đã tải để đổi màu qua lại không tải lại.
// - Đổi bộ frame (đổi màu) giữ nguyên chỉ số frame, chuyển ảnh mờ dần 150ms.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

/** Tải ảnh (có cache dùng chung toàn trang) */
export function loadFrame(url: string): Promise<HTMLImageElement | null> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(url);
  if (running) return running;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      cache.set(url, img);
      pending.delete(url);
      resolve(img);
    };
    img.onerror = () => {
      pending.delete(url);
      resolve(null);
    };
    img.src = url;
  });
  pending.set(url, p);
  return p;
}

/** Tải ngầm toàn bộ frame của một bộ (khi rảnh hoặc khi hover swatch) */
export function warmFrames(frames: string[], from = 0) {
  const order = frames
    .map((_, i) => i)
    .sort((a, b) => dist(a, from, frames.length) - dist(b, from, frames.length));
  const run = () => order.forEach((i) => void loadFrame(frames[i]));
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 50);
}

const dist = (a: number, b: number, n: number) => {
  const d = Math.abs(a - b) % n;
  return Math.min(d, n - d);
};
const mod = (i: number, n: number) => ((i % n) + n) % n;
const PX_PER_FRAME = 8;

interface Props {
  frames: string[];
  frame: number;
  onFrame: (i: number) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  /** frame/giây khi tự xoay */
  speed?: number;
  alt: string;
  /** Nội dung phủ trên khung (card kích thước…) */
  overlay?: ReactNode;
  className?: string;
}

export default function Rotator360({
  frames,
  frame,
  onFrame,
  playing,
  onPlaying,
  speed = 6,
  alt,
  overlay,
  className,
}: Props) {
  const n = frames.length;
  const wrap = useRef<HTMLDivElement>(null);
  const pos = useRef(frame); // vị trí (số thực) để xoay mượt
  const velocity = useRef(0);
  const inertia = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; pos: number; px: number; py: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const lastShown = useRef<string | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(0);
  const [, setTick] = useState(0);
  const [hint, setHint] = useState(true);
  const [prev, setPrev] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [fs, setFs] = useState(false);

  const setPos = useCallback(
    (p: number) => {
      pos.current = p;
      const i = mod(Math.round(p), n);
      if (i !== frameRef.current) onFrame(i);
    },
    [n, onFrame],
  );
  const stopInertia = () => {
    if (inertia.current) cancelAnimationFrame(inertia.current);
    inertia.current = null;
  };
  const interact = () => {
    stopInertia();
    if (playing) onPlaying(false);
  };

  // đồng bộ khi frame đổi từ ngoài (thanh trượt/nút)
  useEffect(() => {
    if (mod(Math.round(pos.current), n) !== frame) pos.current = frame;
  }, [frame, n]);

  // Tải trước frame của bộ hiện tại: frame đang xem và frame 0 trước, rồi theo khoảng cách
  const framesKey = frames.join('|');
  useEffect(() => {
    let cancelled = false;
    const start = mod(Math.round(pos.current), n);
    const order = [
      start,
      0,
      ...frames.map((_, i) => i).sort((a, b) => dist(a, start, n) - dist(b, start, n)),
    ].filter((v, i, arr) => arr.indexOf(v) === i);
    let done = frames.filter((u) => cache.has(u)).length;
    setLoaded(done);
    let cursor = 0;
    const worker = async () => {
      while (!cancelled && cursor < order.length) {
        const i = order[cursor++];
        if (!cache.has(frames[i])) {
          await loadFrame(frames[i]);
          if (cancelled) return;
          done += 1;
        }
        setLoaded(Math.min(done, n));
        if (i === start || i === 0) setTick((t) => t + 1);
      }
    };
    void Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]).then(
      () => !cancelled && setLoaded(n),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [framesKey]);

  // Chuyển ảnh mờ dần khi đổi bộ frame
  const firstSet = useRef(true);
  useEffect(() => {
    if (firstSet.current) {
      firstSet.current = false;
      return;
    }
    if (lastShown.current) {
      setPrev(lastShown.current);
      const t = setTimeout(() => setPrev(null), 170);
      return () => clearTimeout(t);
    }
  }, [framesKey]);

  // Tự xoay
  useEffect(() => {
    if (!playing || n < 2) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setPos(pos.current + speed * dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, n, speed, setPos]);

  // Lăn chuột để phóng to (listener không thụ động để chặn cuộn trang)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const clampZoom = (z: number) => Math.min(3, Math.max(1, z));

  // ----- Pointer -----
  const onPointerDown = (e: React.PointerEvent) => {
    wrap.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    interact();
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, pos: pos.current, px: pan.x, py: pan.y };
      velocity.current = 0;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setZoom(clampZoom((pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (zoom > 1) {
      setPan({ x: d.px + dx, y: d.py + (e.clientY - d.y) });
      return;
    }
    if (Math.abs(dx) > 2) setHint(false);
    const before = pos.current;
    setPos(d.pos - dx / PX_PER_FRAME);
    velocity.current = pos.current - before;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (pointers.current.size === 0 && drag.current && zoom <= 1 && Math.abs(velocity.current) > 0.05) {
      let v = velocity.current;
      const step = () => {
        v *= 0.93;
        if (Math.abs(v) < 0.02) return stopInertia();
        setPos(pos.current + v);
        inertia.current = requestAnimationFrame(step);
      };
      inertia.current = requestAnimationFrame(step);
    }
    if (pointers.current.size === 0) drag.current = null;
  };

  const stepBy = (d: number) => {
    interact();
    setPos(Math.round(pos.current) + d);
  };
  const reset = () => {
    interact();
    setPos(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const toggleFs = () =>
    document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen?.();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') (e.preventDefault(), stepBy(-1));
    else if (e.key === 'ArrowRight') (e.preventDefault(), stepBy(1));
    else if (e.key === ' ') (e.preventDefault(), onPlaying(!playing));
    else if (e.key === '+' || e.key === '=') setZoom((z) => clampZoom(z * 1.25));
    else if (e.key === '-') setZoom((z) => clampZoom(z / 1.25));
    else if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen();
  };

  // ảnh đang hiển thị: frame hiện tại → frame 0 → frame đã tải gần nhất
  const cur = mod(frame, n);
  let shown: string | null = null;
  if (cache.has(frames[cur])) shown = frames[cur];
  else if (cache.has(frames[0])) shown = frames[0];
  else {
    for (let d = 1; d < n && !shown; d++) {
      const a = frames[mod(cur + d, n)];
      const b = frames[mod(cur - d, n)];
      shown = cache.has(a) ? a : cache.has(b) ? b : null;
    }
  }
  if (shown) lastShown.current = shown;
  const deg = Math.round((cur * 360) / n);
  const loading = loaded < n;

  const btn =
    'flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink shadow transition hover:bg-primary-soft disabled:opacity-40';

  return (
    <div
      ref={wrap}
      tabIndex={0}
      role="application"
      aria-label="Xem sản phẩm 360 độ"
      aria-roledescription="trình xem 360 độ"
      data-frame={cur}
      data-zoom={zoom.toFixed(2)}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        'relative flex select-none touch-pan-y flex-col overflow-hidden bg-gradient-to-b from-white to-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-primary',
        zoom > 1 ? 'cursor-move' : 'cursor-grab active:cursor-grabbing',
        fs && 'bg-white',
        className,
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {shown ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: drag.current ? 'none' : 'transform 120ms',
            }}
          >
            <img
              src={shown}
              alt={`${alt} – góc ${deg}°`}
              draggable={false}
              className="h-full w-full object-contain"
            />
            {prev && prev !== shown && (
              <img
                src={prev}
                alt=""
                draggable={false}
                className="rotator-fade absolute h-full w-full object-contain"
              />
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" aria-busy="true">
            <div className="skeleton h-3/4 w-3/4 rounded-card" />
          </div>
        )}
        {hint && !loading && (
          <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-ink/70 px-4 py-1.5 text-xs font-medium text-white">
            Kéo để xoay 360°
          </span>
        )}
        {loading && (
          <div
            className="pointer-events-none absolute left-1/2 top-4 w-60 -translate-x-1/2 rounded-card bg-white/95 p-2.5 text-center text-xs shadow"
            role="status"
          >
            Đang tải ảnh 360° … {loaded}/{n}
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(loaded / n) * 100}%` }}
              />
            </div>
          </div>
        )}
        {overlay}
      </div>

      <div
        className="flex flex-wrap items-center gap-2 border-t border-line/60 bg-white/70 px-3 py-2"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={btn}
          aria-label="Xoay trái 1 bước"
          title="Xoay trái"
          onClick={() => stepBy(-1)}
        >
          <Icon name="rotate" size={17} className="-scale-x-100" />
        </button>
        <button
          type="button"
          className={cn(btn, playing && 'bg-primary text-white hover:bg-primary-hover')}
          aria-label={playing ? 'Dừng tự xoay' : 'Tự xoay'}
          aria-pressed={playing}
          title={playing ? 'Dừng (Space)' : 'Tự xoay (Space)'}
          onClick={() => onPlaying(!playing)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
            {playing ? <path d="M3 2h3v10H3zM8 2h3v10H8z" /> : <path d="M3 1.5v11l9-5.5z" />}
          </svg>
        </button>
        <button
          type="button"
          className={btn}
          aria-label="Xoay phải 1 bước"
          title="Xoay phải"
          onClick={() => stepBy(1)}
        >
          <Icon name="rotate" size={17} />
        </button>
        <input
          type="range"
          min={0}
          max={359}
          step={360 / n}
          value={deg}
          aria-label="Góc xoay"
          aria-valuetext={`${deg} độ`}
          onChange={(e) => {
            interact();
            setPos(Math.round(Number(e.target.value) / (360 / n)));
          }}
          className="min-w-[120px] flex-1 accent-primary"
        />
        <span className="w-12 text-right text-sm font-semibold tabular-nums" aria-hidden>
          {deg}°
        </span>
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            className={btn}
            aria-label="Phóng to"
            onClick={() => setZoom((z) => clampZoom(z * 1.25))}
          >
            <Icon name="zoomIn" size={17} />
          </button>
          <button
            type="button"
            className={btn}
            aria-label="Thu nhỏ"
            onClick={() => setZoom((z) => clampZoom(z / 1.25))}
          >
            <Icon name="zoomOut" size={17} />
          </button>
          <button type="button" className={btn} aria-label="Đặt lại góc" title="Đặt lại" onClick={reset}>
            <Icon name="refresh" size={17} />
          </button>
          <button type="button" className={btn} aria-label="Toàn màn hình" onClick={toggleFs}>
            <Icon name="expand" size={17} />
          </button>
        </div>
        <div className="relative md:hidden">
          <button
            type="button"
            className={btn}
            aria-label="Thêm tùy chọn"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <Icon name="dots" size={17} />
          </button>
          {menu && (
            <div className="absolute bottom-11 right-0 z-10 flex gap-2 rounded-card bg-white p-2 shadow-xl">
              <button
                type="button"
                className={btn}
                aria-label="Phóng to"
                onClick={() => setZoom((z) => clampZoom(z * 1.25))}
              >
                <Icon name="zoomIn" size={17} />
              </button>
              <button
                type="button"
                className={btn}
                aria-label="Thu nhỏ"
                onClick={() => setZoom((z) => clampZoom(z / 1.25))}
              >
                <Icon name="zoomOut" size={17} />
              </button>
              <button type="button" className={btn} aria-label="Đặt lại góc" onClick={reset}>
                <Icon name="refresh" size={17} />
              </button>
              <button type="button" className={btn} aria-label="Toàn màn hình" onClick={toggleFs}>
                <Icon name="expand" size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
