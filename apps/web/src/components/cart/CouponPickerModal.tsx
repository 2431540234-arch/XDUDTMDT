'use client';

// Popup chọn mã giảm giá ở giỏ hàng. Danh sách và tình trạng từng mã do server tính (GET /coupons/available);
// áp/gỡ mã dùng đúng API giỏ hàng nên tiền giảm và tổng tiền luôn lấy từ server.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { queryKeys } from '@/hooks/useCart';
import { cn } from '@/lib/cn';
import { couponDiscountLabel, couponExpiryLabel, couponMinOrderLabel } from '@/lib/coupon';
import { formatCurrency } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { cartApi } from '@/services/cart.api';
import { toast } from '@/store/uiStore';
import type { AvailableCoupon, CartView } from '@/types/api';

interface Props {
  cart: CartView;
  onClose: () => void;
  /** gọi sau khi áp hoặc gỡ mã thành công (trang giỏ xóa lỗi của ô nhập tay) */
  onChanged?: () => void;
}

export default function CouponPickerModal({ cart, onClose, onChanged }: Props) {
  const qc = useQueryClient();
  // khóa theo tạm tính và mã đang áp: giỏ đổi thì không dùng lại danh sách cũ
  const q = useQuery({
    queryKey: ['coupons', 'available', cart.subtotal, cart.coupon?.id ?? 0],
    queryFn: cartApi.availableCoupons,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const set = (next: CartView) => {
    qc.setQueryData(queryKeys.cart, next);
    onChanged?.();
  };
  const apply = useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: (next) => {
      set(next);
      toast.success('Đã áp dụng mã giảm giá.');
      onClose();
    },
    onError: (e) => {
      // mã có thể vừa hết lượt hoặc hết hạn: báo lý do của server và tải lại danh sách
      toast.error(errorMessage(e));
      void q.refetch();
    },
  });
  const remove = useMutation({
    mutationFn: cartApi.removeCoupon,
    onSuccess: (next) => {
      set(next);
      toast.success('Đã bỏ mã giảm giá.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const busy = apply.isPending || remove.isPending;

  return (
    <Modal open onClose={onClose} title="Chọn mã giảm giá" width={560}>
      {q.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Đang tải mã giảm giá">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon="tag" title="Hiện chưa có mã giảm giá nào" className="py-8" />
      ) : (
        <ul className="space-y-3">
          {q.data.map((c) => (
            <CouponOption
              key={c.id}
              coupon={c}
              busy={busy}
              applying={apply.isPending && apply.variables === c.code}
              removing={remove.isPending}
              onApply={() => apply.mutate(c.code)}
              onRemove={() => remove.mutate()}
            />
          ))}
        </ul>
      )}
    </Modal>
  );
}

function CouponOption({
  coupon: c,
  busy,
  applying,
  removing,
  onApply,
  onRemove,
}: {
  coupon: AvailableCoupon;
  busy: boolean;
  applying: boolean;
  removing: boolean;
  onApply: () => void;
  onRemove: () => void;
}) {
  const blocked = !c.eligible && !c.isApplied;
  return (
    <li
      data-testid="coupon-option"
      data-code={c.code}
      className={cn(
        'rounded-card border p-4',
        c.isApplied ? 'border-primary bg-primary-soft/40' : 'border-line',
        blocked && 'bg-surface-muted/50',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={cn('min-w-0', blocked && 'opacity-60')}>
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {c.name}
            {c.isApplied && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
                Đang áp dụng
              </span>
            )}
          </p>
          <p className="text-sm font-semibold text-primary">{couponDiscountLabel(c)}</p>
          <p className="mt-1 text-xs text-muted">
            Mã <span className="font-mono font-semibold text-ink">{c.code}</span> ·{' '}
            {couponMinOrderLabel(c.minOrderValue)} · {couponExpiryLabel(c.endsAt)}
          </p>
          {c.eligible && (
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              {c.type === 'freeship' && c.estimatedDiscount === 0
                ? 'Đơn này đang được miễn phí vận chuyển'
                : `Giảm dự kiến ${formatCurrency(c.estimatedDiscount)}`}
            </p>
          )}
        </div>
        {c.isApplied ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 self-end sm:self-center"
            loading={removing}
            disabled={busy}
            onClick={onRemove}
          >
            Bỏ mã
          </Button>
        ) : (
          <Button
            size="sm"
            className="shrink-0 self-end sm:self-center"
            loading={applying}
            disabled={busy || !c.eligible}
            onClick={onApply}
          >
            Áp dụng
          </Button>
        )}
      </div>
      {blocked && c.reason && <p className="mt-2 text-xs font-semibold text-amber-700">{c.reason}</p>}
    </li>
  );
}
