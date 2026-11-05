'use client';

// Trình xem 3D (WIREFRAME 7.7) dựa trên <model-viewer>: kéo để xoay, cuộn để phóng to,
// thanh công cụ dọc (phóng/thu/đặt lại/toàn màn hình/ánh sáng), card kích thước, tab góc nhìn, đổi màu realtime.
// Chỉ nạp phía trình duyệt (page dùng next/dynamic, ssr:false).
import { useEffect, useRef, useState } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { Model3DView } from '@/types/api';

interface MV extends HTMLElement {
  cameraOrbit: string;
  exposure: number;
  autoRotate: boolean;
  getCameraOrbit(): { theta: number; phi: number; radius: number };
  jumpCameraToGoal(): void;
  model?: { materials: Array<{ pbrMetallicRoughness: { setBaseColorFactor(c: string | number[]): void } }> };
}

const VIEWS = [
  { key: 'persp', label: 'Phối cảnh', orbit: '45deg 70deg auto' },
  { key: 'front', label: 'Trước', orbit: '0deg 80deg auto' },
  { key: 'side', label: 'Bên', orbit: '90deg 80deg auto' },
  { key: 'top', label: 'Trên', orbit: '0deg 0deg auto' },
  { key: 'dims', label: 'Kích thước', orbit: '30deg 75deg auto' },
] as const;

export default function ProductViewer3D({
  model,
  alt,
  tint,
}: {
  model: Model3DView;
  alt: string;
  tint?: string | null;
}) {
  const ref = useRef<MV | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<(typeof VIEWS)[number]['key']>('persp');
  const [light, setLight] = useState(1);
  const [spin, setSpin] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    import('@google/model-viewer').then(() => setReady(true)).catch(() => setError(true));
  }, []);

  // đổi màu realtime: nhuộm vật liệu thân chính của mô hình
  useEffect(() => {
    const el = ref.current;
    if (!el || !tint) return;
    const apply = () => el.model?.materials?.[0]?.pbrMetallicRoughness.setBaseColorFactor(tint);
    if (el.model) apply();
    el.addEventListener('load', apply);
    return () => el.removeEventListener('load', apply);
  }, [tint, ready]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onErr = () => setError(true);
    el.addEventListener('error', onErr);
    return () => el.removeEventListener('error', onErr);
  }, [ready]);

  const zoom = (k: number) => {
    const el = ref.current;
    if (!el) return;
    const o = el.getCameraOrbit();
    el.cameraOrbit = `${o.theta}rad ${o.phi}rad ${Math.max(0.5, o.radius * k)}m`;
  };
  const setOrbit = (key: (typeof VIEWS)[number]['key']) => {
    setView(key);
    const el = ref.current;
    if (el) {
      el.cameraOrbit = VIEWS.find((v) => v.key === key)!.orbit;
      el.jumpCameraToGoal();
    }
  };

  const tools: Array<{ icon: IconName; label: string; run: () => void; active?: boolean }> = [
    { icon: 'zoomIn', label: 'Phóng to', run: () => zoom(0.8) },
    { icon: 'zoomOut', label: 'Thu nhỏ', run: () => zoom(1.25) },
    { icon: 'rotate', label: 'Đặt lại góc nhìn', run: () => setOrbit('persp') },
    { icon: 'expand', label: 'Toàn màn hình', run: () => wrap.current?.requestFullscreen?.() },
    {
      icon: 'info',
      label: 'Ánh sáng',
      run: () => {
        const next = light >= 1.6 ? 0.6 : light + 0.5;
        setLight(next);
        if (ref.current) ref.current.exposure = next;
      },
    },
    {
      icon: 'refresh',
      label: spin ? 'Tắt tự xoay' : 'Bật tự xoay',
      run: () => setSpin((s) => !s),
      active: spin,
    },
  ];

  const mm = (n: number) => `${(n / 10).toFixed(0)} cm`;

  if (error || !model.glbUrl) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 text-muted">
        <Icon name="alert" size={32} />
        <p>Không tải được mô hình 3D.</p>
      </div>
    );
  }

  return (
    <div
      ref={wrap}
      className="relative h-full min-h-[460px] w-full overflow-hidden bg-gradient-to-b from-white to-surface-muted"
    >
      {ready ? (
        <model-viewer
          ref={ref as never}
          class="h-full w-full"
          src={model.glbUrl}
          ios-src={model.usdzUrl ?? undefined}
          alt={alt}
          poster={model.posterUrl ?? undefined}
          ar={model.status === 'ready' ? true : undefined}
          ar-modes="webxr scene-viewer quick-look"
          ar-scale={model.allowScaling ? 'auto' : 'fixed'}
          ar-placement={model.placement === 'wall' ? 'wall' : 'floor'}
          camera-controls
          auto-rotate={spin ? true : undefined}
          shadow-intensity="1"
          exposure={light}
          camera-orbit="45deg 70deg auto"
          style={{ ['--poster-color' as string]: 'transparent' }}
        />
      ) : (
        <div className="flex h-full min-h-[460px] items-center justify-center text-muted" aria-busy>
          Đang tải trình xem 3D…
        </div>
      )}
      <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-xs font-medium shadow">
        Kéo để xoay · Cuộn để phóng to
      </span>
      <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={t.run}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full shadow hover:bg-primary-soft',
              t.active ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-white',
            )}
          >
            <Icon name={t.icon} size={18} />
          </button>
        ))}
      </div>
      <div className="absolute bottom-16 right-4 rounded-card bg-white/95 p-3 text-xs shadow">
        <p className="font-bold">Kích thước (D × R × C)</p>
        <p className="mt-0.5">
          {mm(model.lengthMm)} × {mm(model.widthMm)} × {mm(model.heightMm)}
        </p>
        <p className="mt-1 text-muted">
          {model.glbUrl.split('?')[0].split('.').pop()?.toUpperCase()} ·{' '}
          {model.files.find((f) => f.format === 'glb')?.fileSize
            ? `${(model.files.find((f) => f.format === 'glb')!.fileSize / 1048576).toFixed(1)} MB`
            : ''}
        </p>
      </div>
      {view === 'dims' && (
        <div
          className="pointer-events-none absolute inset-x-10 bottom-24 top-16 border border-dashed border-primary/60"
          aria-hidden
        >
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-primary px-2 py-0.5 text-xs font-bold text-white">
            {mm(model.lengthMm)}
          </span>
          <span className="absolute -right-1 top-1/2 -translate-y-1/2 rounded bg-primary px-2 py-0.5 text-xs font-bold text-white">
            {mm(model.heightMm)}
          </span>
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded bg-primary px-2 py-0.5 text-xs font-bold text-white">
            {mm(model.widthMm)}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <div className="flex gap-1 rounded-full bg-white/95 p-1 shadow" role="tablist" aria-label="Góc nhìn">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setOrbit(v.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium',
                view === v.key ? 'bg-primary text-white' : 'hover:bg-surface-muted',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
