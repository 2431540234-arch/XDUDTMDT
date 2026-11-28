'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CouponView } from '@/types/api';

export function couponHeadline(c: Pick<CouponView, 'kind' | 'value'>): string {
  if (c.kind === 'percent') return `GIẢM ${c.value}%`;
  if (c.kind === 'fixed') return `GIẢM ${formatCurrency(c.value)}`;
  return 'FREESHIP';
}

interface Props {
  coupon?: Pick<CouponView, 'code' | 'name' | 'kind' | 'value' | 'minOrderValue' | 'endsAt'>;
  onUse?: () => void;
  /** chữ thay cho dòng "HSD: …" mặc định, ví dụ "Còn 3 ngày" */
  expiryText?: string;
  /** dòng bổ sung dưới tên (mức giảm, mô tả, số lượt còn lại) */
  details?: ReactNode;
  /** thay nút "Sử dụng ngay" mặc định */
  actions?: ReactNode;
}

/** Coupon dạng vé (cạnh trái răng cưa nền be) – trang Mã giảm giá của khách và xem trước khi admin tạo khuyến mãi */
export default function CouponCard({ coupon: c, onUse, expiryText, details, actions }: Props) {
  if (!c) return null;
  return (
    <div className="flex overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div className="relative flex w-36 shrink-0 flex-col items-center justify-center bg-surface-muted px-3 py-4 text-center sm:w-44">
        <span
          className="absolute -left-2 top-0 h-full w-4"
          style={{
            backgroundImage: 'radial-gradient(circle at 0 8px, #fff 6px, transparent 6.5px)',
            backgroundSize: '16px 16px',
          }}
          aria-hidden
        />
        <p className="text-lg font-extrabold leading-tight text-primary">{couponHeadline(c)}</p>
        <p className="mt-1 text-xs text-muted">
          {c.minOrderValue > 0 ? `Đơn tối thiểu ${formatCurrency(c.minOrderValue)}` : 'Mọi đơn hàng'}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="truncate font-bold">{c.name}</p>
          {details}
          <p className="mt-0.5 text-xs text-muted">
            Mã: <span className="font-mono font-semibold text-ink">{c.code}</span>
          </p>
          <p className="text-xs text-muted">
            {expiryText ?? `HSD: ${c.endsAt ? formatDate(c.endsAt) : 'Không giới hạn'}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-row flex-wrap items-center gap-3 sm:flex-col sm:items-end">
          {actions ? (
            actions
          ) : onUse ? (
            <button
              type="button"
              onClick={onUse}
              className="rounded-btn bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              Sử dụng ngay
            </button>
          ) : (
            <Link
              href="/cart"
              className="rounded-btn bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              Sử dụng ngay
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
