'use client';

// Trình xem 3D toàn trang (WIREFRAME 7.7) – /products/:slug/3d
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button, { LinkButton } from '@/components/ui/Button';
import ColorSwatch from '@/components/ui/ColorSwatch';
import Icon from '@/components/ui/Icon';
import StarRating from '@/components/ui/StarRating';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useCartActions } from '@/hooks/useCart';
import { useProduct } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/format';
import { toast } from '@/store/uiStore';

const ProductViewer3D = dynamic(() => import('@/components/viewer/ProductViewer3D'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[460px] items-center justify-center text-muted">Đang tải trình xem 3D…</div>
  ),
});

export default function Viewer3DPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const q = useProduct(slug);
  const { addToCart, adding } = useCartActions();
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const p = q.data;

  useEffect(() => {
    if (!p) return;
    const dv = p.variants.find((v) => v.id === p.defaultVariantId) ?? p.variants[0];
    setColor(dv?.color?.name ?? null);
    setSize(dv?.size ?? null);
  }, [p?.id]);

  const variant =
    p?.variants.find((v) => (v.color?.name ?? null) === color && (v.size ?? null) === size) ?? null;
  const hex = p?.colors.find((c) => c.name === color)?.hex ?? null;

  if (q.isLoading)
    return (
      <div className="container-page py-10">
        <PageSkeleton />
      </div>
    );
  if (q.isError)
    return (
      <div className="container-page py-10">
        <ErrorState onRetry={() => q.refetch()} />
      </div>
    );
  if (!p) return null;
  if (!p.model) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="cube"
          title="Sản phẩm này chưa có mô hình 3D"
          description="Bạn vẫn có thể xem ảnh và thông tin chi tiết của sản phẩm."
          action={<LinkButton href={`/products/${p.slug}`}>Xem chi tiết sản phẩm</LinkButton>}
        />
      </div>
    );
  }
  const price = variant?.salePrice ?? variant?.price ?? p.salePrice ?? p.price;
  const sizes = p.sizes.filter((s) => s !== 'Tiêu chuẩn');
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Đã sao chép liên kết.');
    } catch {
      toast.info(window.location.href);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Quay lại"
            onClick={() => router.back()}
            className="rounded-full p-2 hover:bg-surface-muted"
          >
            <Icon name="arrowLeft" />
          </button>
          <h1 className="text-sm font-bold sm:text-base">
            {p.name} <span className="font-normal text-muted">· Trình xem 3D</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={share}>
            <Icon name="share" size={15} /> Chia sẻ
          </Button>
          <Link
            href={`/products/${p.slug}`}
            aria-label="Đóng"
            className="rounded-full p-2 hover:bg-surface-muted"
          >
            <Icon name="close" />
          </Link>
        </div>
      </header>
      <div className="grid flex-1 lg:grid-cols-[1fr_380px]">
        <div className="min-h-[460px]">
          <ProductViewer3D
            model={p.model}
            alt={`Mô hình 3D ${p.name}`}
            tint={hex}
            fallbackImage={p.images[0]?.url ?? null}
          />
        </div>
        <aside className="space-y-5 overflow-y-auto border-l border-line bg-white p-6">
          <div>
            <h2 className="text-xl font-extrabold">{p.name}</h2>
            <StarRating value={p.ratingAvg} count={p.ratingCount} size={15} className="mt-1" />
            <p className="mt-2 text-2xl font-extrabold text-danger">{formatCurrency(price)}</p>
          </div>
          {p.colors.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">
                Màu sắc: <span className="font-normal text-muted">{color}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                {p.colors.map((c) => (
                  <ColorSwatch
                    key={c.name}
                    hex={c.hex}
                    name={c.name}
                    size={28}
                    selected={color === c.name}
                    onClick={() => setColor(c.name)}
                  />
                ))}
              </div>
            </div>
          )}
          {p.material && (
            <p className="text-sm">
              <span className="font-semibold">Chất liệu:</span>{' '}
              <span className="text-muted">{p.material}</span>
            </p>
          )}
          {sizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Kích thước</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={size === s}
                    onClick={() => setSize(s)}
                    className={`rounded-btn border px-3 py-1.5 text-sm ${size === s ? 'border-primary bg-primary text-white' : 'border-line hover:border-primary'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Button
              block
              size="lg"
              loading={adding}
              disabled={!variant || variant.stockQuantity <= 0}
              onClick={() => variant && addToCart(variant.id, 1)}
            >
              <Icon name="cart" size={18} /> Thêm vào giỏ hàng
            </Button>
            <LinkButton block size="lg" variant="outline" href={`/products/${p.slug}`}>
              Xem chi tiết sản phẩm
            </LinkButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
