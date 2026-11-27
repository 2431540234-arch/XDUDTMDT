'use client';

// Màn duyệt mô hình 3D chờ duyệt: xem thử (không tô màu) cạnh ảnh đầu vào, so kích thước, chọn bản đã gỡ / chưa gỡ
// tấm sàn, xoay, rồi Duyệt hoặc Bỏ. Ảnh chờ (poster) được chụp từ chính trình xem lúc bấm Duyệt.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Button from '@/components/ui/Button';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatFileSize } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { ModelReviewDetail, ModelVariantKey } from '@/types/api';

interface ViewerElement extends HTMLElement {
  cameraOrbit: string;
  loaded?: boolean;
  jumpCameraToGoal(): void;
  toDataURL(type?: string, quality?: number): string;
}

const VARIANT_LABEL: Record<ModelVariantKey, string> = {
  cleaned: 'Đã gỡ tấm sàn',
  original: 'Chưa gỡ (nguyên hình)',
};

const cm = (mm: number) => `${(mm / 10).toFixed(1)} cm`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`;

function PreviewViewer({
  src,
  viewerRef,
}: {
  src: string;
  viewerRef: React.MutableRefObject<ViewerElement | null>;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    import('@google/model-viewer').then((m) => {
      m.ModelViewerElement.meshoptDecoderLocation = '/vendor/meshopt_decoder.js';
      setReady(true);
    });
  }, []);
  useEffect(() => setFailed(false), [src]);
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const onError = () => setFailed(true);
    el.addEventListener('error', onError);
    return () => el.removeEventListener('error', onError);
  }, [ready, src, viewerRef]);
  if (failed)
    return (
      <p role="alert" className="flex h-full items-center justify-center p-4 text-center text-sm text-danger">
        Không tải được tệp xem thử.
      </p>
    );
  if (!ready || !src)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">Đang tải bản xem thử…</div>
    );
  return (
    <model-viewer
      ref={viewerRef as never}
      data-testid="review-viewer"
      class="h-full w-full"
      src={src}
      alt="Bản xem thử mô hình chờ duyệt"
      camera-controls
      shadow-intensity="1"
      camera-orbit="45deg 70deg auto"
    />
  );
}

export default function ModelReview({
  modelId,
  onChanged,
  extraActions,
}: {
  modelId: number;
  /** gọi sau khi duyệt/bỏ/chuẩn hóa lại để trang cha tải lại */
  onChanged: () => void;
  /** nút bổ sung (ví dụ "Tạo lại" cho mô hình AI) */
  extraActions?: (detail: ModelReviewDetail) => ReactNode;
}) {
  const q = useQuery({
    queryKey: ['admin', 'model', modelId],
    queryFn: () => adminApi.models.detail(modelId),
  });
  const d = q.data;
  const [picked, setPicked] = useState<ModelVariantKey | null>(null);
  const variant: ModelVariantKey = picked && d?.variants[picked] ? picked : (d?.defaultVariant ?? 'original');
  const info = d?.variants[variant];
  const viewer = useRef<ViewerElement | null>(null);

  const [src, setSrc] = useState('');
  const fileSize = info?.files.medium.size;
  useEffect(() => {
    if (!d || !info) return;
    let url = '';
    let cancelled = false;
    setSrc('');
    adminApi.models
      .previewUrl(d, variant)
      .then((u) => {
        url = u;
        if (!cancelled) setSrc(u);
      })
      .catch((e) => toast.error(errorMessage(e)));
    return () => {
      cancelled = true;
      if (url.startsWith('blob:') && !d.mockPreviewUrl) URL.revokeObjectURL(url);
    };
    // fileSize đổi khi chuẩn hóa lại ⇒ tải bản mới
  }, [d?.id, variant, fileSize, d?.options.yawDeg]);

  /** Chụp ảnh chờ ở góc nhìn mặc định; không chụp được thì để máy chủ dùng ảnh khác */
  const capturePoster = async (): Promise<string | undefined> => {
    const el = viewer.current;
    if (!el?.loaded) return undefined;
    try {
      el.cameraOrbit = '45deg 70deg auto';
      el.jumpCameraToGoal();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return el.toDataURL('image/png');
    } catch {
      return undefined;
    }
  };

  const approve = useMutation({
    mutationFn: async () =>
      adminApi.models.approve(modelId, { variant, posterDataUrl: await capturePoster() }),
    onSuccess: () => {
      toast.success('Đã duyệt. Khách hàng đã thấy nút xem 3D.');
      onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: () => adminApi.models.reject(modelId),
    onSuccess: () => {
      toast.success('Đã bỏ mô hình.');
      onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const renormalize = useMutation({
    mutationFn: (body: { yawDeg?: number; removeFloor?: boolean }) =>
      adminApi.models.renormalize(modelId, body),
    onSuccess: () => {
      toast.info('Đang chuẩn hóa lại từ tệp gốc (không tốn lượt tạo AI).');
      setPicked(null);
      onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !d) return <ErrorState onRetry={() => q.refetch()} />;
  if (d.status !== 'pending_review' || !info) return null;
  const r = info.report;
  const busy = approve.isPending || reject.isPending || renormalize.isPending;
  const keys = (['cleaned', 'original'] as const).filter((k) => d.variants[k]);

  return (
    <section data-testid="model-review" className="space-y-4 rounded-card border border-primary/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Mô hình chờ duyệt – khách chưa nhìn thấy</h3>
        <p className="text-xs text-muted">
          {d.source === 'ai' ? `Tạo bằng AI (${d.space ?? '?'})` : `Tải lên: ${d.fileName ?? ''}`}
          {d.generatedSeconds ? ` · ${Math.round(d.generatedSeconds)} giây` : ''}
        </p>
      </div>

      {keys.length > 1 && (
        <div role="tablist" aria-label="Phiên bản" className="flex flex-wrap gap-2">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={variant === k}
              onClick={() => setPicked(k)}
              className={cn(
                'rounded-btn border px-3 py-1.5 text-sm',
                variant === k ? 'border-primary bg-primary text-white' : 'border-line hover:border-primary',
              )}
            >
              {VARIANT_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      <div className={cn('grid gap-3', d.sourceImageUrl && 'md:grid-cols-2')}>
        {d.sourceImageUrl && (
          <figure>
            <div className="h-72 overflow-hidden rounded-btn border border-line bg-surface-muted">
              <img src={d.sourceImageUrl} alt="Ảnh đầu vào" className="h-full w-full object-contain" />
            </div>
            <figcaption className="mt-1 text-xs text-muted">
              Ảnh đầu vào{d.colorName ? ` · màu ${d.colorName}` : ''}
            </figcaption>
          </figure>
        )}
        <figure>
          <div className="h-72 overflow-hidden rounded-btn border border-line bg-gradient-to-b from-white to-surface-muted">
            <PreviewViewer src={src} viewerRef={viewer} />
          </div>
          <figcaption className="mt-1 text-xs text-muted">
            Bản xem thử: {VARIANT_LABEL[variant]}. Kéo để xoay.
          </figcaption>
        </figure>
      </div>

      <table className="w-full text-sm" data-testid="review-sizes">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-1">Chiều</th>
            <th>Sau chuẩn hóa</th>
            <th>Kích thước thật</th>
            <th>Lệch</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['Dài', 'length'],
              ['Rộng', 'width'],
              ['Cao', 'height'],
            ] as const
          ).map(([label, k]) => (
            <tr key={k} className="border-t border-line">
              <td className="py-1">{label}</td>
              <td>{cm(r.measuredMm[k])}</td>
              <td>{cm(r.targetMm[k])}</td>
              <td className={cn(Math.abs(r.deviationPct[k]) > 15 && 'font-bold text-danger')}>
                {signed(r.deviationPct[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">
        {r.triangles.toLocaleString('vi-VN')} tam giác · LOD cao {formatFileSize(info.files.high.size)} · vừa{' '}
        {formatFileSize(info.files.medium.size)} · thấp {formatFileSize(info.files.low.size)}
        {info.files.high.textureResolution ? ` · texture ${info.files.high.textureResolution}px` : ''}
        {` · xoay ${(r.autoYawDeg + r.manualYawDeg) % 360}°`}
      </p>
      {r.warnings.map((w) => (
        <p key={w} role="alert" className="rounded-btn bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {w}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button loading={approve.isPending} disabled={busy || !src} onClick={() => approve.mutate()}>
          Duyệt {keys.length > 1 ? `bản “${VARIANT_LABEL[variant]}”` : ''}
        </Button>
        {extraActions?.(d)}
        <Button variant="danger" loading={reject.isPending} disabled={busy} onClick={() => reject.mutate()}>
          Bỏ
        </Button>
        <span className="mx-1 h-6 w-px bg-line" />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => renormalize.mutate({ yawDeg: (d.options.yawDeg + 90) % 360 })}
        >
          Xoay 90°
        </Button>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={d.options.removeFloor}
            disabled={busy}
            onChange={(e) => renormalize.mutate({ removeFloor: e.target.checked })}
          />
          Gỡ tấm sàn nếu phát hiện
        </label>
      </div>
      <p className="text-xs text-muted">
        Duyệt sẽ thay mô hình đang hiện (mô hình cũ bị xóa). Xoay hoặc đổi tùy chọn gỡ sàn chỉ xử lý lại tệp
        đã có.
      </p>
    </section>
  );
}
