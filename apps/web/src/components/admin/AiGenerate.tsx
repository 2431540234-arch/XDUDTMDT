'use client';

// Tạo mô hình 3D bằng AI từ MỘT ảnh sản phẩm. Ảnh được gửi tới Hugging Face (bên thứ ba) nên admin phải xác nhận
// trước lần tạo đầu tiên của mỗi phiên.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { ProductDetail } from '@/types/api';

const CONSENT_KEY = 'aurelia-ai3d-consent';

/** Đã xác nhận trong phiên trình duyệt này chưa (gắn theo tài khoản đang đăng nhập qua sessionStorage) */
export function useAiConsent() {
  const [consented, setConsented] = useState(false);
  useEffect(() => {
    try {
      setConsented(sessionStorage.getItem(CONSENT_KEY) === 'yes');
    } catch {
      /* không có sessionStorage thì hỏi lại mỗi lần */
    }
  }, []);
  const remember = () => {
    setConsented(true);
    try {
      sessionStorage.setItem(CONSENT_KEY, 'yes');
    } catch {
      /* bỏ qua */
    }
  };
  return { consented, remember };
}

export const useAiStatus = () =>
  useQuery({ queryKey: ['admin', 'ai3d', 'status'], queryFn: () => adminApi.models.aiStatus() });

/** Chỉ ảnh chụp (không phải ảnh minh họa SVG) mới dùng được để tạo mô hình */
const isPhoto = (url: string) => !/\.svg(\?|$)|\/mock-img\//i.test(url);

export default function AiGenerate({
  product,
  busy,
  onStarted,
}: {
  product: ProductDetail;
  /** sản phẩm đang có mô hình chạy hoặc chờ duyệt */
  busy: boolean;
  onStarted: () => void;
}) {
  const status = useAiStatus();
  const s = status.data;
  const photos = product.images.filter((i) => isPhoto(i.url));
  const [imageId, setImageId] = useState<number | null>(null);
  const [space, setSpace] = useState('');
  const [removeFloor, setRemoveFloor] = useState(true);
  const [agree, setAgree] = useState(false);
  const { consented, remember } = useAiConsent();
  const selected = photos.find((p) => p.id === imageId) ?? photos.find((p) => p.isPrimary) ?? photos[0];
  const chosenSpace = s?.spaces.find((x) => x.id === space) ?? s?.spaces[0];

  const create = useMutation({
    mutationFn: () =>
      adminApi.models.aiCreate({
        productId: product.id,
        imageId: selected!.id,
        space: chosenSpace?.id,
        removeFloor,
        consent: true,
      }),
    onSuccess: () => {
      remember();
      toast.success('Đã đưa vào hàng đợi tạo mô hình. Việc này có thể mất vài phút.');
      onStarted();
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      status.refetch();
    },
  });

  if (status.isLoading) return <p className="text-muted">Đang kiểm tra tính năng AI…</p>;
  if (!s) return null;

  const blocked = !s.enabled
    ? s.reason
    : busy
      ? 'Sản phẩm đang có một mô hình đang xử lý hoặc chờ duyệt. Hãy duyệt hoặc bỏ mô hình đó trước.'
      : (s.limitReached ??
        (photos.length ? null : 'Sản phẩm chưa có ảnh chụp (JPG, PNG, WebP) để tạo mô hình.'));

  return (
    <div className="space-y-3 rounded-card border border-line p-4" data-testid="ai-generate">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Tạo mô hình 3D bằng AI</p>
        {s.enabled && (
          <p className="text-xs text-muted" data-testid="ai-usage">
            Hôm nay: {s.usage.usedToday}/{s.usage.perDay} lượt · trong 1 giờ: {s.usage.usedLastHour}/
            {s.usage.perHour} (cả hệ thống)
          </p>
        )}
      </div>

      {s.enabled && photos.length > 0 && (
        <>
          <div>
            <p className="mb-1.5 text-xs font-medium">
              Chọn một ảnh (rõ toàn bộ sản phẩm, nền trơn cho kết quả tốt)
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ảnh đầu vào">
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected?.id === p.id}
                  aria-label={`Ảnh ${p.sortOrder}`}
                  onClick={() => setImageId(p.id)}
                  className={cn(
                    'h-20 w-24 overflow-hidden rounded-md border-2 bg-surface-muted',
                    selected?.id === p.id ? 'border-primary' : 'border-transparent hover:border-line',
                  )}
                >
                  <img src={p.url} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>
          {s.spaces.length > 1 && (
            <Select
              label="Máy chủ AI (space)"
              value={chosenSpace?.id ?? ''}
              onChange={(e) => setSpace(e.target.value)}
              options={s.spaces.map((x) => ({
                value: x.id,
                label: `${x.label}${x.role === 'fallback' ? ' – dự phòng' : ''}`,
              }))}
            />
          )}
          {chosenSpace && <p className="text-xs text-muted">{chosenSpace.note}</p>}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={removeFloor}
              onChange={(e) => setRemoveFloor(e.target.checked)}
            />
            Gỡ tấm sàn thừa nếu phát hiện
          </label>
          <p className="rounded-btn bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Ảnh đã chọn sẽ được <b>gửi tới máy chủ Hugging Face (bên thứ ba)</b> để dựng mô hình. Chỉ gửi ảnh
            bạn có quyền sử dụng. Mỗi lần tạo đều tốn lượt GPU, kể cả khi lỗi.
          </p>
          {!consented && (
            <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              Tôi đồng ý gửi ảnh tới Hugging Face và có quyền sử dụng ảnh này.
            </label>
          )}
        </>
      )}

      {blocked && (
        <p role="note" data-testid="ai-blocked" className="text-xs text-muted">
          {blocked}
        </p>
      )}
      <Button
        loading={create.isPending}
        disabled={Boolean(blocked) || !(consented || agree)}
        onClick={() => create.mutate()}
      >
        <Icon name="cube" size={16} /> Tạo mô hình 3D bằng AI
      </Button>

      {s.lastError && (
        <details className="text-xs" data-testid="ai-last-error">
          <summary className="cursor-pointer text-danger">
            Lỗi gần nhất từ Hugging Face ({formatDate(s.lastError.at)}): {s.lastError.message}
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-surface-muted p-2">
            {s.lastError.space ? `${s.lastError.space}\n` : ''}
            {s.lastError.raw}
          </pre>
        </details>
      )}
    </div>
  );
}
