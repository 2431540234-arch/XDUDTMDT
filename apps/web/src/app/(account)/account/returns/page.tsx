'use client';

// Danh sách đổi trả & hoàn tiền của khách (dùng lại layout Đơn hàng của tôi – WIREFRAME 7.9)
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import { LinkButton } from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { formatCurrency, formatDate } from '@/lib/format';
import { returnReasonLabel, returnStatusInfo } from '@/lib/status';
import { returnApi } from '@/services/cart.api';

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'picking', label: 'Đang lấy hàng' },
  { key: 'inspecting', label: 'Đang kiểm tra' },
  { key: 'refunded', label: 'Đã hoàn tiền' },
  { key: 'rejected', label: 'Từ chối' },
] as const;

export default function ReturnsPage() {
  const [tab, setTab] = useState<string>('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['returns', tab, page],
    queryFn: () => returnApi.list({ status: tab || undefined, page }),
  });
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Đổi trả & hoàn tiền</h1>
          <p className="mt-1 text-sm text-muted">
            Theo dõi các yêu cầu đổi trả của bạn. Để tạo yêu cầu mới, chọn đơn hàng đã giao trong 7 ngày.
          </p>
        </div>
        <LinkButton href="/account/orders?tab=completed" variant="outline">
          Chọn đơn hàng
        </LinkButton>
      </div>
      <Tabs
        className="mt-5"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <div className="mt-5 space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.data?.items.length ? (
          <>
            {q.data.items.map((r) => (
              <article key={r.id} className="card p-5">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <p className="font-bold">
                      #{r.code} <span className="font-normal text-muted">· Đơn {r.orderCode}</span>
                    </p>
                    <p className="text-xs text-muted">
                      Gửi ngày {formatDate(r.createdAt)} ·{' '}
                      {r.type === 'refund' ? 'Trả hàng & hoàn tiền' : 'Đổi sản phẩm khác'}
                    </p>
                  </div>
                  <StatusBadge info={returnStatusInfo[r.status]} />
                </header>
                <ul className="mt-3 space-y-2">
                  {r.items.map((it, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                        {it.imageUrl && (
                          <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <span className="flex-1">
                        {it.productName} <span className="text-muted">x{it.quantity}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted">Lý do: {returnReasonLabel[r.reason]}</p>
                {r.adminNote && (
                  <p className="mt-1 rounded bg-surface-muted/60 p-2 text-sm">
                    Phản hồi từ cửa hàng: {r.adminNote}
                  </p>
                )}
                <p className="mt-2 text-right text-sm">
                  Hoàn dự kiến: <b className="text-primary">{formatCurrency(r.refundAmount)}</b>
                </p>
              </article>
            ))}
            <Pagination page={q.data.meta.page} totalPages={q.data.meta.totalPages} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon="refresh"
            title="Chưa có yêu cầu đổi trả"
            description="Các yêu cầu đổi trả của bạn sẽ hiển thị tại đây."
          />
        )}
      </div>
    </div>
  );
}
