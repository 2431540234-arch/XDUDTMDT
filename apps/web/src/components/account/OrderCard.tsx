'use client';

import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { orderStatusInfo } from '@/lib/status';
import type { OrderView } from '@/types/api';

interface Props {
  order: OrderView;
  onReview?: (order: OrderView) => void;
}

/** Thẻ đơn hàng (WIREFRAME 2.10): mã đơn, ngày đặt, sản phẩm, tổng tiền, hành động theo trạng thái */
export default function OrderCard({ order, onReview }: Props) {
  const done = order.status === 'completed';
  const canReturn = done && order.canReturnUntil && new Date(order.canReturnUntil) > new Date();
  return (
    <article className="card p-5">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="font-bold">#{order.orderCode}</p>
          <p className="text-xs text-muted">
            Đặt ngày {formatDate(order.createdAt)} | {order.itemCount} sản phẩm
          </p>
        </div>
        <StatusBadge info={orderStatusInfo[order.status]} />
      </header>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto]">
        <ul className="space-y-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                {it.imageUrl && (
                  <img src={it.imageUrl} alt={it.productName} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold">{it.productName}</p>
                <p className="text-xs text-muted">Phân loại: {it.variantLabel}</p>
                <p className="text-xs text-muted">x{it.quantity}</p>
              </div>
              <p className="text-sm font-semibold">{formatCurrency(it.unitPrice)}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-line pt-3 md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="md:text-right">
            <p className="text-xs text-muted">Tổng tiền</p>
            <p className="text-lg font-extrabold text-primary">{formatCurrency(order.total)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/account/orders/${order.orderCode}`}
              className="rounded-btn border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              Xem chi tiết
            </Link>
            {done && onReview && (
              <button
                type="button"
                onClick={() => onReview(order)}
                className="rounded-btn bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Đánh giá sản phẩm
              </button>
            )}
            {canReturn && (
              <Link
                href={`/account/returns/new?order=${order.orderCode}`}
                className="rounded-btn border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
              >
                Yêu cầu đổi trả
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
