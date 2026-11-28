'use client';

// Mã giảm giá (WIREFRAME 2.9): các mã công khai khách còn dùng được. Không có chức năng lưu mã. Trang này chỉ nêu điều kiện
// của mã, không xét theo giỏ hàng (việc đó nằm ở popup trong giỏ).
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import CouponCard from '@/components/account/CouponCard';
import Button, { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { couponDiscountLabel, couponExpiryLabel } from '@/lib/coupon';
import { cartApi } from '@/services/cart.api';
import { toast } from '@/store/uiStore';
import type { AvailableCoupon } from '@/types/api';

/** Theo hạn dùng (sắp hết hạn trước, không hạn cuối cùng): thứ tự không phụ thuộc giỏ hàng */
const byExpiry = (a: AvailableCoupon, b: AvailableCoupon) => {
  const end = (c: AvailableCoupon) => (c.endsAt ? new Date(c.endsAt).getTime() : Number.MAX_SAFE_INTEGER);
  return end(a) - end(b) || a.code.localeCompare(b.code);
};

export default function MyCouponsPage() {
  const q = useQuery({
    queryKey: ['coupons', 'available', 'account'],
    queryFn: cartApi.availableCoupons,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  /** mã phải chép tay vì trình duyệt không cho ghi vào clipboard */
  const [manual, setManual] = useState<number | null>(null);

  const copy = async (c: AvailableCoupon) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard không được hỗ trợ');
      await navigator.clipboard.writeText(c.code);
      setManual(null);
      toast.success(`Đã sao chép mã ${c.code}`);
    } catch {
      setManual(c.id);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Mã giảm giá</h1>
      <p className="mt-1 text-sm text-muted">
        Các mã đang dùng được. Sao chép mã hoặc chọn ngay trong giỏ hàng khi mua.
      </p>
      <div className="mt-5 space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.data?.length ? (
          [...q.data].sort(byExpiry).map((c) => (
            <div key={c.id} data-testid="account-coupon" data-code={c.code}>
              <CouponCard
                coupon={{ ...c, kind: c.type }}
                expiryText={couponExpiryLabel(c.endsAt)}
                details={
                  <>
                    <p className="text-xs font-semibold text-primary">{couponDiscountLabel(c)}</p>
                    {c.description && <p className="text-xs text-muted">{c.description}</p>}
                    {c.remainingForUser !== null && (
                      <p className="text-xs text-muted">Bạn còn {c.remainingForUser} lượt dùng</p>
                    )}
                  </>
                }
                actions={
                  <>
                    <Button variant="outline" size="sm" onClick={() => void copy(c)}>
                      Sao chép mã
                    </Button>
                    <LinkButton href="/cart" size="sm">
                      Dùng ngay
                    </LinkButton>
                  </>
                }
              />
              {manual === c.id && (
                <label className="mt-2 block text-xs text-muted">
                  Trình duyệt không cho sao chép tự động. Hãy chọn và chép mã:
                  <input
                    readOnly
                    autoFocus
                    value={c.code}
                    onFocus={(e) => e.currentTarget.select()}
                    className="field mt-1 font-mono font-semibold text-ink"
                  />
                </label>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            icon="tag"
            title="Hiện chưa có mã giảm giá nào dành cho bạn"
            description="Nếu bạn có mã riêng, hãy nhập trực tiếp ở giỏ hàng."
            action={<LinkButton href="/cart">Đến giỏ hàng</LinkButton>}
          />
        )}
      </div>
    </div>
  );
}
