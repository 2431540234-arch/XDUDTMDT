'use client';

import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate } from '@/lib/format';
import { userCouponStatusInfo } from '@/lib/status';
import type { CouponView, UserCouponView } from '@/types/api';

export function couponHeadline(c: Pick<CouponView, 'kind' | 'value'>): string {
  if (c.kind === 'percent') return `GIẢM ${c.value}%`;
  if (c.kind === 'fixed') return `GIẢM ${formatCurrency(c.value)}`;
  return 'FREESHIP';
}

/** Coupon dạng vé (cạnh trái răng cưa nền be) – dùng ở "Mã giảm giá của tôi" và xem trước khi admin tạo khuyến mãi */
export default function CouponCard({
  item,
  coupon: preview,
  onUse,
}: {
  item?: UserCouponView;
  coupon?: CouponView;
  onUse?: () => void;
}) {
  const c = item?.coupon ?? preview;
  if (!c) return null;
  const status = item?.status ?? 'unused';
  const disabled = status !== 'unused';
  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-card border border-line bg-white shadow-card',
        disabled && 'opacity-80',
      )}
    >
      <div className="relative flex w-36 shrink-0 flex-col items-center justify-center bg-surface-muted px-3 py-4 text-center sm:w-44">
        <span
          className="absolute -left-2 top-0 h-full w-4"
          style={{
            backgroundImage: 'radial-gradient(circle at 0 8px, #fff 6px, transparent 6.5px)',
            backgroundSize: '16px 16px',
          }}
          aria-hidden
        />
        <p className={cn('text-lg font-extrabold leading-tight', disabled ? 'text-muted' : 'text-primary')}>
          {couponHeadline(c)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {c.minOrderValue > 0 ? `Đơn tối thiểu ${formatCurrency(c.minOrderValue)}` : 'Mọi đơn hàng'}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="truncate font-bold">{c.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            Mã: <span className="font-mono font-semibold text-ink">{c.code}</span>
          </p>
          <p className="text-xs text-muted">HSD: {c.endsAt ? formatDate(c.endsAt) : 'Không giới hạn'}</p>
          <p className="text-xs text-muted">Áp dụng cho: {c.appliesToLabel}</p>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
          {item && <StatusBadge info={userCouponStatusInfo[status]} />}
          {onUse ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onUse}
              className="rounded-btn bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
            >
              Sử dụng ngay
            </button>
          ) : (
            <Link
              href="/cart"
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
              className={cn(
                'rounded-btn px-4 py-2 text-xs font-semibold',
                disabled
                  ? 'pointer-events-none bg-stone-300 text-stone-500'
                  : 'bg-primary text-white hover:bg-primary-hover',
              )}
            >
              Sử dụng ngay
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
