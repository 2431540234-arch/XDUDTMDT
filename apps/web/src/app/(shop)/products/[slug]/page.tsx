'use client';

// Chi tiết sản phẩm (WIREFRAME 2.3): gallery | thông tin → banner 3D → tabs → sản phẩm liên quan
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import ProductCard from '@/components/product/ProductCard';
import ProductGallery from '@/components/product/ProductGallery';
import ProductInfo from '@/components/product/ProductInfo';
import ProductTabs from '@/components/product/ProductTabs';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useProduct } from '@/hooks/useProducts';
import { discountPercent } from '@/lib/format';
import { pushRecent } from '@/lib/recent';
import { parseVariantQuery, variantQuery } from '@/lib/variant';
import { productApi } from '@/services/product.api';
import { ApiClientError } from '@/services/api-client';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const q = useProduct(slug);
  const related = useQuery({
    queryKey: ['related', slug],
    queryFn: () => productApi.related(slug),
    enabled: Boolean(q.data),
  });
  const qc = useQueryClient();
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<'desc' | 'specs' | 'reviews' | 'qa'>('desc');

  const p = q.data;
  // chọn mặc định theo biến thể mặc định của sản phẩm
  useEffect(() => {
    if (!p) return;
    const dv = p.variants.find((v) => v.id === p.defaultVariantId) ?? p.variants[0];
    // ưu tiên lựa chọn từ URL (?color=&size=, đồng bộ với trang Xem 360°)
    const fromUrl = parseVariantQuery(p.variants, window.location.search);
    setColor(fromUrl.color ?? dv?.color?.name ?? null);
    setSize(fromUrl.size ?? dv?.size ?? null);
    setActive(0);
  }, [p?.id]);

  useEffect(() => {
    if (p)
      pushRecent({ slug: p.slug, name: p.name, thumbnailUrl: p.thumbnailUrl, price: p.salePrice ?? p.price });
  }, [p?.id]);

  const variant = useMemo(
    () =>
      p?.variants.find((v) => v.isActive && (v.color?.name ?? null) === color && (v.size ?? null) === size) ??
      null,
    [p, color, size],
  );

  const pickColor = (c: string) => {
    setColor(c);
    const v =
      p?.variants.find((x) => x.color?.name === c && x.size === size) ??
      p?.variants.find((x) => x.color?.name === c);
    if (v) setSize(v.size);
    // chuyển ảnh sang ảnh của màu vừa chọn (nếu có)
    const vids = p?.variants.filter((x) => x.color?.name === c).map((x) => x.id) ?? [];
    const idx = p?.images.findIndex((im) => im.variantId !== null && vids.includes(im.variantId)) ?? -1;
    setActive(idx >= 0 ? idx : 0);
  };

  if (q.isLoading)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (q.isError) {
    const notFound = q.error instanceof ApiClientError && q.error.status === 404;
    return (
      <div className="container-page py-8">
        {notFound ? (
          <EmptyState
            icon="search"
            title="Không tìm thấy sản phẩm"
            description="Sản phẩm có thể đã ngừng bán hoặc đường dẫn không đúng."
            action={<LinkButton href="/products">Xem sản phẩm khác</LinkButton>}
          />
        ) : (
          <ErrorState onRetry={() => q.refetch()} />
        )}
      </div>
    );
  }
  if (!p) return null;
  const price = variant?.salePrice ?? variant?.price ?? p.salePrice ?? p.price;
  const original = variant ? (variant.salePrice ? variant.price : null) : p.salePrice ? p.price : null;

  return (
    <div className="container-page py-6">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, ...p.breadcrumb, { label: p.name }]} />
      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
        <ProductGallery
          images={p.images}
          name={p.name}
          active={active}
          onActive={setActive}
          model3dHref={p.model ? `/products/${p.slug}/3d` : null}
          href360={p.has360 ? `/products/${p.slug}/360${variantQuery(color, size)}` : null}
          onPrefetch360={() => {
            void qc.prefetchQuery({ queryKey: ['p360', p.slug], queryFn: () => productApi.view360(p.slug) });
          }}
          discount={discountPercent(price, original)}
        />
        <ProductInfo
          product={p}
          color={color}
          size={size}
          onColor={pickColor}
          onSize={setSize}
          variant={variant}
          onReviewsClick={() => {
            setTab('reviews');
            document.getElementById('tabs')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-surface-muted p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-primary">
            <Icon name="cube" size={28} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold">Trải nghiệm sản phẩm 3D</h2>
            <p className="text-sm text-muted">
              Xoay 360°, phóng to và đặt thử {p.name} vào căn phòng của bạn bằng AR.
            </p>
          </div>
        </div>
        <LinkButton href={`/products/${p.slug}/3d`} size="lg">
          Trải nghiệm 3D ngay <Icon name="arrowRight" size={16} />
        </LinkButton>
      </section>

      <ProductTabs product={p} tab={tab} onTab={setTab} />

      <section className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-extrabold uppercase">Sản phẩm liên quan</h2>
          {p.category && (
            <LinkButton href={`/products?category=${p.category.slug}`} variant="ghost" size="sm">
              Xem tất cả <Icon name="arrowRight" size={14} />
            </LinkButton>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {related.data?.map((x) => (
            <ProductCard key={x.id} product={x} />
          ))}
        </div>
      </section>
    </div>
  );
}
