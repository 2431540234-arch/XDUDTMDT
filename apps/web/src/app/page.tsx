'use client';

// Trang chủ (WIREFRAME 2.1): hero slider → danh mục nổi bật → SP nổi bật → banner 3D → SP mới → 2 banner
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import StoreLayout from '@/components/layout/StoreLayout';
import ProductCard from '@/components/product/ProductCard';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { ErrorState, ProductGridSkeleton, Skeleton } from '@/components/ui/States';
import { useCategories } from '@/hooks/useProducts';
import { cn } from '@/lib/cn';
import { contentApi } from '@/services/content.api';
import { productApi } from '@/services/product.api';

function Hero() {
  const q = useQuery({ queryKey: ['banners'], queryFn: contentApi.banners });
  const slides = (q.data ?? []).filter((b) => b.position.startsWith('hero'));
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (q.isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (q.isError) return <ErrorState message="Không tải được banner." onRetry={() => q.refetch()} />;
  if (!slides.length) return null;
  const s = slides[i % slides.length];
  return (
    <section
      className="relative overflow-hidden bg-surface-muted"
      aria-roledescription="carousel"
      aria-label="Banner chính"
    >
      <div
        className="relative h-[420px] sm:h-[480px]"
        style={{
          backgroundImage: `url(${s.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/30 to-transparent" />
        <div className="container-page relative flex h-full flex-col justify-center text-white">
          <p className="text-xs font-semibold tracking-[0.3em] text-white/80">AURELIA LIVING</p>
          <h1 className="mt-3 max-w-xl text-3xl font-extrabold uppercase leading-tight sm:text-5xl">
            {s.title}
          </h1>
          {s.subtitle && <p className="mt-3 max-w-md text-sm text-white/85 sm:text-base">{s.subtitle}</p>}
          <LinkButton href={s.link} size="lg" className="mt-6 w-fit">
            KHÁM PHÁ SẢN PHẨM <Icon name="arrowRight" size={16} />
          </LinkButton>
        </div>
        {slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Slide trước"
              onClick={() => setI((x) => (x - 1 + slides.length) % slides.length)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 hover:bg-white"
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              aria-label="Slide sau"
              onClick={() => setI((x) => (x + 1) % slides.length)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 hover:bg-white"
            >
              <Icon name="chevronRight" />
            </button>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
              {slides.map((x, k) => (
                <button
                  key={x.id}
                  type="button"
                  aria-label={`Slide ${k + 1}`}
                  onClick={() => setI(k)}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    k === i % slides.length ? 'w-6 bg-white' : 'w-2 bg-white/50',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-xl font-extrabold uppercase tracking-wide">{title}</h2>
      <Link
        href={href}
        className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        Xem tất cả <Icon name="arrowRight" size={15} />
      </Link>
    </div>
  );
}

function ProductRow({ params }: { params: Parameters<typeof productApi.list>[0] }) {
  const q = useQuery({ queryKey: ['home-products', params], queryFn: () => productApi.list(params) });
  if (q.isLoading) return <ProductGridSkeleton count={4} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {q.data?.items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const cats = useCategories();
  const featured =
    cats.data
      ?.flatMap((c) => c.children)
      .filter((c) => c.isFeatured)
      .slice(0, 6) ?? [];
  const banners = useQuery({ queryKey: ['banners'], queryFn: contentApi.banners });
  const left = banners.data?.find((b) => b.position === 'home-left');
  const right = banners.data?.find((b) => b.position === 'home-right');

  return (
    <StoreLayout>
      <Hero />
      <div className="container-page space-y-14 py-12">
        <section>
          <SectionHead title="Danh mục nổi bật" href="/products" />
          {cats.isError ? (
            <ErrorState onRetry={() => cats.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {(cats.isLoading ? Array.from({ length: 6 }) : featured).map((c, i) =>
                c ? (
                  <Link
                    key={(c as (typeof featured)[number]).id}
                    href={`/products?category=${(c as (typeof featured)[number]).slug}`}
                    className="group text-center"
                  >
                    <div className="aspect-square overflow-hidden rounded-card bg-surface-muted">
                      <img
                        src={(c as (typeof featured)[number]).imageUrl ?? ''}
                        alt={(c as (typeof featured)[number]).name}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </div>
                    <p className="mt-2 text-sm font-semibold group-hover:text-primary">
                      {(c as (typeof featured)[number]).name}
                    </p>
                  </Link>
                ) : (
                  <Skeleton key={i} className="aspect-square" />
                ),
              )}
            </div>
          )}
        </section>

        <section>
          <SectionHead title="Sản phẩm nổi bật" href="/products?sort=soldCount:desc" />
          <ProductRow params={{ featured: true, sort: 'soldCount:desc', pageSize: 4 }} />
        </section>

        <section className="overflow-hidden rounded-2xl bg-surface-muted">
          <div className="grid items-center gap-6 md:grid-cols-2">
            <div className="p-8 sm:p-12">
              <p className="text-xs font-semibold tracking-[0.25em] text-primary">CÔNG NGHỆ 3D · AR</p>
              <h2 className="mt-2 text-2xl font-extrabold uppercase sm:text-3xl">Trải nghiệm sản phẩm 3D</h2>
              <p className="mt-3 max-w-md text-sm text-muted">
                Xoay, phóng to và quan sát sản phẩm từ mọi góc 360° ngay trên website, đặt thử vào căn phòng
                của bạn bằng AR trước khi quyết định mua.
              </p>
              <LinkButton href="/products?has3d=true" size="lg" className="mt-5">
                TRẢI NGHIỆM NGAY <Icon name="arrowRight" size={16} />
              </LinkButton>
            </div>
            <div className="relative h-64 md:h-full md:min-h-[300px]">
              <img
                src="/mock-img/product?t=sofa&c=C9B8A0&v=4"
                alt="Sofa xem 360 độ"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-sm font-extrabold text-primary shadow">
                360°
              </span>
            </div>
          </div>
        </section>

        <section>
          <SectionHead title="Sản phẩm mới" href="/products?sort=createdAt:desc" />
          <ProductRow params={{ sort: 'createdAt:desc', pageSize: 4 }} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {[
            {
              b: left,
              cta: 'KHÁM PHÁ NGAY',
              fallback: {
                title: 'BỘ SƯU TẬP MỚI',
                subtitle: 'Phong cách hiện đại cho mọi không gian',
                link: '/spaces',
                imageUrl: '',
              },
            },
            {
              b: right,
              cta: 'XEM CHI TIẾT',
              fallback: {
                title: 'ƯU ĐÃI ĐẶC BIỆT',
                subtitle: 'Giảm đến 20% cho nhiều sản phẩm',
                link: '/products',
                imageUrl: '',
              },
            },
          ].map(({ b, cta, fallback }) => {
            const x = b ?? fallback;
            return (
              <Link
                key={x.title}
                href={x.link}
                className="group relative block h-56 overflow-hidden rounded-2xl bg-surface-muted"
              >
                {x.imageUrl && (
                  <img
                    src={x.imageUrl}
                    alt={x.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-ink/70 to-transparent" />
                <div className="relative flex h-full flex-col justify-center p-8 text-white">
                  <h3 className="text-2xl font-extrabold">{x.title}</h3>
                  <p className="mt-1 text-sm text-white/85">{x.subtitle}</p>
                  <span className="mt-4 w-fit rounded-btn bg-white px-4 py-2 text-sm font-bold text-primary">
                    {cta}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </StoreLayout>
  );
}
