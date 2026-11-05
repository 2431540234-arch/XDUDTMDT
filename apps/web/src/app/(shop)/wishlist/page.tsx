'use client';

// Sản phẩm yêu thích (WIREFRAME 2.12)
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import ProductCard from '@/components/product/ProductCard';
import SortToolbar from '@/components/product/SortToolbar';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { LinkButton } from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/hooks/useCart';
import { cn } from '@/lib/cn';
import { wishlistApi } from '@/services/product.api';

const PAGE = 8;
const SORTS = [
  { value: 'recent', label: 'Mới lưu gần đây' },
  { value: 'price:asc', label: 'Giá tăng dần' },
  { value: 'price:desc', label: 'Giá giảm dần' },
  { value: 'name', label: 'Tên A–Z' },
];

export default function WishlistPage() {
  const { user, hydrated } = useAuth();
  const q = useQuery({ queryKey: queryKeys.wishlist, queryFn: wishlistApi.list, enabled: Boolean(user) });
  const [sort, setSort] = useState('recent');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => {
    const l = [...(q.data ?? [])];
    if (sort === 'price:asc') l.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
    if (sort === 'price:desc') l.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
    if (sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return l;
  }, [q.data, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const items = sorted.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);

  return (
    <div className="container-page py-6">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Sản phẩm yêu thích' }]} />
      <section className="mb-6 rounded-2xl bg-surface-muted p-8">
        <h1 className="text-3xl font-extrabold">Sản phẩm yêu thích</h1>
        <p className="mt-1 text-muted">Danh sách những sản phẩm bạn đã lưu</p>
      </section>
      {!hydrated ? (
        <PageSkeleton />
      ) : !user ? (
        <EmptyState
          icon="heart"
          title="Đăng nhập để xem sản phẩm yêu thích"
          description="Danh sách yêu thích được lưu theo tài khoản của bạn."
          action={<LinkButton href="/login?next=/wishlist">Đăng nhập</LinkButton>}
        />
      ) : q.isLoading ? (
        <PageSkeleton />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : sorted.length ? (
        <>
          <SortToolbar
            total={sorted.length}
            sort={sort}
            onSort={(v) => {
              setSort(v);
              setPage(1);
            }}
            layout={layout}
            onLayout={setLayout}
            options={SORTS}
          />
          <div className={cn(layout === 'grid' ? 'grid grid-cols-2 gap-4 lg:grid-cols-4' : 'space-y-4')}>
            {items.map((p) => (
              <ProductCard key={p.id} product={p} layout={layout} />
            ))}
          </div>
          <Pagination className="mt-8" page={Math.min(page, pages)} totalPages={pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon="heart"
          title="Chưa có sản phẩm yêu thích"
          description="Bấm biểu tượng ♡ trên sản phẩm để lưu lại xem sau."
          action={<LinkButton href="/products">Khám phá sản phẩm</LinkButton>}
        />
      )}
    </div>
  );
}
