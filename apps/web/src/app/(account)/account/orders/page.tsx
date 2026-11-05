'use client';

// Đơn hàng của tôi (WIREFRAME 2.10) + modal đánh giá (7.8)
import { useQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import OrderCard from '@/components/account/OrderCard';
import ReviewModal from '@/components/account/ReviewModal';
import { LinkButton } from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useQueryParams } from '@/hooks/useQueryParams';
import { orderApi } from '@/services/cart.api';
import type { OrderView } from '@/types/api';

const TABS = [
  { key: 'all', label: 'Tất cả', status: '' },
  { key: 'pending', label: 'Chờ xác nhận', status: 'pending' },
  { key: 'processing', label: 'Đang xử lý', status: 'confirmed,processing' },
  { key: 'shipping', label: 'Đang giao', status: 'shipping' },
  { key: 'completed', label: 'Đã giao', status: 'completed' },
  { key: 'cancelled', label: 'Đã hủy', status: 'cancelled,refunded' },
] as const;

function Content() {
  const qp = useQueryParams();
  const tab = (qp.get('tab', 'all') as (typeof TABS)[number]['key']) || 'all';
  const page = qp.getNum('page', 1);
  const [reviewing, setReviewing] = useState<OrderView | null>(null);
  const counts = useQuery({ queryKey: ['orders', 'counts'], queryFn: orderApi.counts });
  const status = TABS.find((t) => t.key === tab)?.status ?? '';
  const q = useQuery({
    queryKey: ['orders', 'list', tab, page],
    queryFn: () => orderApi.list({ status: (status || undefined) as never, page, pageSize: 5 }),
  });
  const c = counts.data;
  const countOf = (k: string) =>
    !c
      ? undefined
      : k === 'all'
        ? c.all
        : k === 'processing'
          ? c.confirmed + c.processing
          : k === 'cancelled'
            ? c.cancelled + c.refunded
            : c[k];

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Đơn hàng của tôi</h1>
      <p className="mt-1 text-sm text-muted">
        Theo dõi, đánh giá và yêu cầu đổi trả cho các đơn hàng của bạn.
      </p>
      <Tabs
        className="mt-5"
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: countOf(t.key) }))}
        value={tab}
        onChange={(k) => qp.set({ tab: k === 'all' ? null : k })}
      />
      <div className="mt-5 space-y-4">
        {q.isLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.data?.items.length ? (
          <>
            {q.data.items.map((o) => (
              <OrderCard key={o.id} order={o} onReview={setReviewing} />
            ))}
            <Pagination
              page={q.data.meta.page}
              totalPages={q.data.meta.totalPages}
              onChange={(p) => qp.set({ page: p }, { keepPage: true })}
            />
          </>
        ) : (
          <EmptyState
            icon="receipt"
            title="Chưa có đơn hàng"
            description="Bạn chưa có đơn hàng nào ở trạng thái này."
            action={<LinkButton href="/products">Mua sắm ngay</LinkButton>}
          />
        )}
      </div>
      <ReviewModal open={Boolean(reviewing)} order={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
