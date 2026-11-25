'use client';

// Tab Mô tả / Đánh giá trên trang chi tiết sản phẩm
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import ReviewCard from '@/components/account/ReviewCard';
import Pagination from '@/components/ui/Pagination';
import StarRating from '@/components/ui/StarRating';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { productApi } from '@/services/product.api';
import type { ProductDetail } from '@/types/api';

type TabKey = 'desc' | 'reviews';

function Reviews({ p }: { p: ProductDetail }) {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(0);
  const q = useQuery({
    queryKey: ['reviews', p.slug, page, rating],
    queryFn: () => productApi.reviews(p.slug, { page, rating: rating || undefined }),
  });
  const total = p.ratingCount || 1;
  return (
    <div>
      <div className="mb-6 grid gap-6 rounded-card bg-surface-muted/60 p-5 sm:grid-cols-[180px_1fr]">
        <div className="text-center">
          <p className="text-5xl font-extrabold text-primary">{p.ratingAvg.toFixed(1)}</p>
          <StarRating value={p.ratingAvg} size={18} className="mt-1" />
          <p className="mt-1 text-sm text-muted">{p.ratingCount} đánh giá</p>
        </div>
        <div className="space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setRating(rating === n ? 0 : n);
                setPage(1);
              }}
              className="flex w-full items-center gap-3 text-sm"
              aria-pressed={rating === n}
            >
              <span className="w-10 text-left font-medium">{n} sao</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-star"
                  style={{ width: `${(p.ratingBreakdown[n] / total) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right text-muted">{p.ratingBreakdown[n]}</span>
            </button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data?.items.length ? (
        <div className="space-y-4">
          {q.data.items.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          <Pagination page={q.data.meta.page} totalPages={q.data.meta.totalPages} onChange={setPage} />
        </div>
      ) : (
        <EmptyState
          icon="star"
          title="Chưa có đánh giá"
          description={
            rating
              ? 'Không có đánh giá nào ở mức sao này.'
              : 'Hãy là người đầu tiên đánh giá sản phẩm này sau khi mua hàng.'
          }
        />
      )}
    </div>
  );
}

export default function ProductTabs({
  product: p,
  tab,
  onTab,
}: {
  product: ProductDetail;
  tab: TabKey;
  onTab: (t: TabKey) => void;
}) {
  return (
    <section id="tabs" className="mt-12">
      <Tabs
        value={tab}
        onChange={onTab}
        items={[
          { key: 'desc', label: 'Mô tả sản phẩm' },
          { key: 'reviews', label: `Đánh giá (${p.ratingCount})` },
        ]}
      />
      <div className="pt-6">
        {tab === 'desc' && (
          <div className="max-w-3xl space-y-4 text-sm leading-relaxed">
            {p.description?.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <h3 className="pt-2 font-bold">Đặc điểm nổi bật</h3>
            <ul className="list-disc space-y-1.5 pl-5">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {tab === 'reviews' && <Reviews p={p} />}
      </div>
    </section>
  );
}
