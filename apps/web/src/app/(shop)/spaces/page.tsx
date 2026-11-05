'use client';

// Không gian mẫu – bộ sưu tập (WIREFRAME 2.14)
import { Suspense, useState } from 'react';
import SortToolbar from '@/components/product/SortToolbar';
import SpaceCard from '@/components/product/SpaceCard';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, ProductGridSkeleton } from '@/components/ui/States';
import { useQueryParams } from '@/hooks/useQueryParams';
import { useSpaceFacets, useSpaces } from '@/hooks/useSpaces';
import { cn } from '@/lib/cn';
import { roomTypeLabel } from '@/lib/status';
import { useUIStore } from '@/store/uiStore';

const SORTS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Xem nhiều nhất' },
  { value: 'title', label: 'Tên A–Z' },
];

function Content() {
  const qp = useQueryParams();
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState(qp.get('q'));
  const style = qp.get('style');
  const roomType = qp.get('roomType');
  const sort = qp.get('sort', 'newest');
  const page = qp.getNum('page', 1);
  const featured = useSpaces({ sort: 'popular', pageSize: 6 });
  const list = useSpaces({ q: qp.get('q'), style, roomType: roomType as never, sort, page, pageSize: 8 });
  const facets = useSpaceFacets();
  const setDrawer = useUIStore((s) => s.setFilterDrawerOpen);

  const sidebar = (
    <div className="card space-y-5 p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          qp.set({ q: search });
        }}
        role="search"
      >
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm không gian mẫu…"
            aria-label="Tìm kiếm không gian mẫu"
            className="field pl-9"
          />
        </div>
      </form>
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide">Phong cách</h3>
        <ul className="space-y-1.5">
          {facets.data?.styles.map((s) => (
            <li key={s.value}>
              <button
                type="button"
                onClick={() => qp.set({ style: style === s.value ? null : s.value })}
                aria-pressed={style === s.value}
                className={cn(
                  'flex w-full justify-between rounded px-2 py-1.5 text-sm',
                  style === s.value
                    ? 'bg-surface-muted font-semibold text-primary'
                    : 'hover:bg-surface-muted/60',
                )}
              >
                {s.value} <span className="text-muted">({s.count})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide">Loại không gian</h3>
        <ul className="space-y-1.5">
          {facets.data?.roomTypes.map((s) => (
            <li key={s.value}>
              <button
                type="button"
                onClick={() => qp.set({ roomType: roomType === s.value ? null : s.value })}
                aria-pressed={roomType === s.value}
                className={cn(
                  'flex w-full justify-between rounded px-2 py-1.5 text-sm',
                  roomType === s.value
                    ? 'bg-surface-muted font-semibold text-primary'
                    : 'hover:bg-surface-muted/60',
                )}
              >
                {roomTypeLabel[s.value]} <span className="text-muted">({s.count})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
  const drawerOpen = useUIStore((s) => s.filterDrawerOpen);

  return (
    <>
      <section className="bg-gradient-to-r from-surface-muted to-bg">
        <div className="container-page py-12">
          <h1 className="text-3xl font-extrabold">Không gian mẫu</h1>
          <p className="mt-3 max-w-xl text-muted">
            Khám phá các bộ sưu tập nội thất được thiết kế sẵn giúp bạn dễ dàng hình dung và lựa chọn phong
            cách phù hợp.
          </p>
          <LinkButton href="#tat-ca" className="mt-5" size="lg">
            Khám phá ngay <Icon name="arrowRight" size={16} />
          </LinkButton>
        </div>
      </section>
      <div className="container-page space-y-12 py-10">
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-extrabold uppercase">Bộ sưu tập nổi bật</h2>
            <a href="#tat-ca" className="text-sm font-semibold text-primary hover:underline">
              Xem tất cả →
            </a>
          </div>
          {featured.isLoading ? (
            <ProductGridSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {featured.data?.items.map((s) => (
                <SpaceCard key={s.id} space={s} featured />
              ))}
            </div>
          )}
        </section>

        <section id="tat-ca">
          <h2 className="mb-5 text-xl font-extrabold uppercase">Tất cả không gian mẫu</h2>
          <div className="flex gap-6">
            <aside className="hidden w-[250px] shrink-0 lg:block">{sidebar}</aside>
            {drawerOpen && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} />
                <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-white p-4">
                  {sidebar}
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SortToolbar
                total={list.data?.meta.total ?? 0}
                unit="không gian"
                sort={sort}
                onSort={(v) => qp.set({ sort: v })}
                layout={layout}
                onLayout={setLayout}
                options={SORTS}
                showFilterButton
              />
              {list.isError ? (
                <ErrorState onRetry={() => list.refetch()} />
              ) : list.isLoading ? (
                <ProductGridSkeleton count={8} />
              ) : list.data?.items.length ? (
                <>
                  <div
                    className={cn(layout === 'grid' ? 'grid grid-cols-2 gap-4 xl:grid-cols-4' : 'space-y-4')}
                  >
                    {list.data.items.map((s) => (
                      <SpaceCard key={s.id} space={s} layout={layout} />
                    ))}
                  </div>
                  <Pagination
                    className="mt-8"
                    page={list.data.meta.page}
                    totalPages={list.data.meta.totalPages}
                    onChange={(p) => qp.set({ page: p }, { keepPage: true })}
                  />
                </>
              ) : (
                <EmptyState
                  icon="image"
                  title="Không có không gian phù hợp"
                  description="Thử bỏ bớt bộ lọc hoặc dùng từ khóa khác."
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default function SpacesPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
