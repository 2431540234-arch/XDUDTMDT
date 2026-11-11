'use client';

// Danh sách sản phẩm dùng chung cho /products (WIREFRAME 2.2) và /search (2.13):
// breadcrumb → banner → FilterSidebar | (toolbar + lưới 4 cột) → phân trang. Trạng thái lưu trên URL.
import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, ProductGridSkeleton } from '@/components/ui/States';
import { LinkButton } from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { useHydrated } from '@/hooks/useHydrated';
import { useQueryParams } from '@/hooks/useQueryParams';
import { useCategories, useProductFacets, useProducts } from '@/hooks/useProducts';
import { cn } from '@/lib/cn';
import FilterSidebar, { emptyFilter, priceBounds, type FilterValue } from './FilterSidebar';
import ProductCard from './ProductCard';
import SortToolbar from './SortToolbar';

export default function ProductListing({ mode }: { mode: 'list' | 'search' }) {
  const qp = useQueryParams();
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const q = qp.get('q');
  const filter: FilterValue = {
    category: qp.getList('category'),
    price: qp.getList('price'),
    color: qp.getList('color'),
    material: qp.getList('material'),
    style: qp.getList('style'),
  };
  const sort = qp.get('sort', mode === 'search' ? 'relevance' : 'createdAt:desc');
  const page = qp.getNum('page', 1);
  const has3d = qp.get('has3d') === 'true';

  const params = {
    q: mode === 'search' ? q : undefined,
    category: filter.category,
    ...priceBounds(filter.price),
    color: filter.color,
    material: filter.material,
    style: filter.style,
    has3d: has3d || undefined,
    sort,
    page,
    pageSize: 12,
  };
  const products = useProducts(params as never, mode);
  const facets = useProductFacets({ q: mode === 'search' ? q : undefined } as never);
  const cats = useCategories();
  // Lần render đầu ở client phải giống HTML máy chủ (máy chủ không có dữ liệu danh mục): chỉ dùng danh mục sau khi hydrate.
  // Nếu không, khi Header (ngoài <Suspense>) nạp xong ['categories'] trước lúc nội dung này hydrate thì breadcrumb/tiêu đề lệch.
  const hydrated = useHydrated();
  const catData = hydrated ? cats.data : undefined;

  const currentCat =
    filter.category.length === 1
      ? (catData?.flatMap((c) => [c, ...c.children]).find((c) => c.slug === filter.category[0]) ?? null)
      : null;
  const total = products.data?.meta.total ?? 0;

  const setFilter = (v: FilterValue) =>
    qp.set({ category: v.category, price: v.price, color: v.color, material: v.material, style: v.style });

  const crumbs =
    mode === 'search'
      ? [{ label: 'Trang chủ', href: '/' }, { label: 'Kết quả tìm kiếm' }]
      : [
          { label: 'Trang chủ', href: '/' },
          { label: 'Sản phẩm', href: currentCat || has3d ? '/products' : undefined },
          ...(currentCat?.parentName ? [{ label: currentCat.parentName }] : []),
          ...(currentCat ? [{ label: currentCat.name }] : []),
        ];

  return (
    <div className="container-page py-6">
      <Breadcrumb items={crumbs} />
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-surface-muted">
        <div className="grid items-center md:grid-cols-[1fr_320px]">
          <div className="p-6 sm:p-10">
            {mode === 'search' ? (
              <>
                <h1 className="text-2xl font-extrabold sm:text-3xl">
                  Kết quả tìm kiếm cho “<span className="text-primary">{q}</span>”
                </h1>
                <p className="mt-2 text-sm text-muted">
                  {products.isLoading ? 'Đang tìm kiếm…' : `Tìm thấy ${total} sản phẩm phù hợp`}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold sm:text-3xl">
                  {currentCat?.name ?? (has3d ? 'Sản phẩm có mô hình 3D' : 'Tất cả sản phẩm')}
                </h1>
                <p className="mt-1 font-medium text-primary">
                  {currentCat
                    ? `Khám phá các mẫu ${currentCat.name.toLowerCase()} tại Aurelia Living`
                    : 'Nơi nội thất 3D sống gần hơn với bạn'}
                </p>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  {currentCat?.description ??
                    'Bộ sưu tập nội thất hiện đại, chất liệu chọn lọc, hỗ trợ xem 3D trước khi mua.'}
                </p>
              </>
            )}
          </div>
          <div className="hidden h-44 md:block">
            <img
              src={currentCat?.imageUrl ?? '/mock-img/product?t=sofa&c=C9B8A0&v=4'}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <div className="flex gap-6">
        <FilterSidebar facets={facets.data} value={filter} onChange={setFilter} />
        <div className="min-w-0 flex-1">
          <SortToolbar
            total={total}
            sort={sort}
            onSort={(v) => qp.set({ sort: v })}
            layout={layout}
            onLayout={setLayout}
            showFilterButton
          />
          {products.isError ? (
            <ErrorState onRetry={() => products.refetch()} />
          ) : products.isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : products.data?.items.length ? (
            <>
              <div
                className={cn(
                  layout === 'grid' ? 'grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-4',
                  products.isFetching && 'opacity-60 transition-opacity',
                )}
              >
                {products.data.items.map((p) => (
                  <ProductCard key={p.id} product={p} layout={layout} />
                ))}
              </div>
              <Pagination
                className="mt-8"
                page={products.data.meta.page}
                totalPages={products.data.meta.totalPages}
                onChange={(p) => qp.set({ page: p }, { keepPage: true })}
              />
            </>
          ) : (
            <EmptyState
              icon="search"
              title="Không tìm thấy sản phẩm phù hợp"
              description="Hãy thử bỏ bớt bộ lọc hoặc dùng từ khóa khác."
              action={
                <div className="flex gap-2">
                  <LinkButton href="/products" variant="outline">
                    Xem tất cả sản phẩm
                  </LinkButton>
                </div>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

export { emptyFilter };
