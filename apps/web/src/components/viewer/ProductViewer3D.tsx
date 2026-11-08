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
  model?: {
    materials: Array<{
      name: string;
      pbrMetallicRoughness: {
        baseColorFactor: number[];
        setBaseColorFactor(c: string | number[]): void;
        setRoughnessFactor(v: number): void;
        setMetallicFactor(v: number): void;
      };
    }>;
  };
}

const VIEWS = [
  { key: 'persp', label: 'Phối cảnh', orbit: '45deg 70deg auto' },
  { key: 'front', label: 'Trước', orbit: '0deg 80deg auto' },
  { key: 'side', label: 'Bên', orbit: '90deg 80deg auto' },
  { key: 'top', label: 'Trên', orbit: '0deg 0deg auto' },
  { key: 'dims', label: 'Kích thước', orbit: '30deg 75deg auto' },
] as const;

type Lod = 'high' | 'medium' | 'low';

/** Điện thoại hoặc mạng chậm / bật tiết kiệm dữ liệu ⇒ dùng LOD thấp (UC-3D-01 bước 4); mặc định LOD medium */
export function preferredLod(): Lod {
  if (typeof window === 'undefined') return 'medium';
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string; downlink?: number };
  };
  const slow =
    Boolean(nav.connection?.saveData) ||
    ['slow-2g', '2g', '3g'].includes(nav.connection?.effectiveType ?? '') ||
    (nav.connection?.downlink !== undefined && nav.connection.downlink < 1.5);
  const phone =
    window.matchMedia?.('(max-width: 767px)').matches || /Android|iPhone|iPod/i.test(navigator.userAgent);
  return slow || phone ? 'low' : 'medium';
}

/** Chọn tệp GLB theo LOD ưu tiên; thiếu thì lùi dần về LOD gần nhất có sẵn, cuối cùng là glbUrl */
export function pickGlb(
  model: Model3DView,
  want: Lod,
): { url: string | null; lod: Lod | null; size: number | null } {
  const order: Lod[] =
    want === 'low'
      ? ['low', 'medium', 'high']
      : want === 'medium'
        ? ['medium', 'high', 'low']
        : ['high', 'medium', 'low'];
  for (const lod of order) {
    const f = model.files.find((x) => x.format === 'glb' && x.lod === lod);
    if (f?.url) return { url: f.url, lod, size: f.fileSize };
  }
  return { url: model.glbUrl, lod: null, size: null };
}

export default function ProductViewer3D({
  model,
  alt,
  tint,
  variantId,
  fallbackImage,
}: {
  model: Model3DView;
  alt: string;
  tint?: string | null;
  /** Biến thể đang chọn: nếu mô hình có cấu hình vật liệu cho biến thể này thì áp ngay lên vật liệu tương ứng (không tải lại mô hình) */
  variantId?: number | null;
  /** Ảnh thay thế khi không tải được mô hình (mặc định ảnh poster của mô hình) */
  fallbackImage?: string | null;
}) {
  const [want] = useState<Lod>(preferredLod);
  const glb = pickGlb(model, want);
  const ref = useRef<MV | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<(typeof VIEWS)[number]['key']>('persp');
  const [light, setLight] = useState(1);
  const [spin, setSpin] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    import('@google/model-viewer')
      .then((m) => {
        // LOD do máy chủ sinh được nén Meshopt: dùng bộ giải nén phục vụ tại chỗ thay vì CDN (xem public/vendor/README.md)
        m.ModelViewerElement.meshoptDecoderLocation = '/vendor/meshopt_decoder.js';
        setReady(true);
      })
      .catch(() => setError(true));
  }, []);

  // UC-3D-03: cấu hình vật liệu của biến thể đang chọn (từ dữ liệu mô hình đã tải cùng trang, không gọi thêm API)
  const mv = variantId == null ? undefined : model.materialVariants?.find((x) => x.variantId === variantId);
  const [applied, setApplied] = useState('');

  // đổi màu realtime: có cấu hình vật liệu của biến thể thì áp lên đúng vật liệu theo tên; không thì nhuộm vật liệu thân chính
  useEffect(() => {
    const el = ref.current;
    if (!el || (!mv && !tint)) return;
    const apply = () => {
      const mats = el.model?.materials;
      if (!mats?.length) return;
      if (mv) {
        const m = mats.find((x) => x.name === mv.materialName);
        if (!m) return;
        const c = mv.config;
        if (c.baseColor) m.pbrMetallicRoughness.setBaseColorFactor(c.baseColor);
        if (c.roughness !== undefined) m.pbrMetallicRoughness.setRoughnessFactor(c.roughness);
        if (c.metalness !== undefined) m.pbrMetallicRoughness.setMetallicFactor(c.metalness);
        setApplied(`${mv.materialName}=${c.baseColor ?? ''}`);
      } else {
        mats[0].pbrMetallicRoughness.setBaseColorFactor(tint!);
        setApplied('');
      }
    };
    if (el.model) apply();
    el.addEventListener('load', apply);
    return () => el.removeEventListener('load', apply);
  }, [mv, tint, ready]);

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

  if (error || !glb.url) {
    const img = model.posterUrl ?? fallbackImage;
    return (
      <div
        data-testid="viewer-3d-fallback"
        className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-4 text-center text-muted"
      >
        {img && <img src={img} alt={alt} className="max-h-72 rounded-card object-contain" />}
        <Icon name="alert" size={32} />
        <p role="alert">Không tải được mô hình 3D. Bạn vẫn có thể xem ảnh sản phẩm.</p>
      </div>
    );
  }

  return (
    <div
      ref={wrap}
      data-testid="viewer-3d"
      data-lod={glb.lod ?? ''}
      data-material-applied={applied}
      className="relative h-full min-h-[460px] w-full overflow-hidden bg-gradient-to-b from-white to-surface-muted"
    >
      {ready ? (
        <model-viewer
          ref={ref as never}
          class="h-full w-full"
          src={glb.url}
          alt={alt}
          poster={model.posterUrl ?? undefined}
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
          GLB{glb.lod ? ` · LOD ${glb.lod}` : ''}
          {glb.size ? ` · ${(glb.size / 1048576).toFixed(1)} MB` : ''}
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
