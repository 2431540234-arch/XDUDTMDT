'use client';

// Trang Xem 360° của sản phẩm (/products/[slug]/360): xoay bằng chuỗi ảnh, đổi màu/kích thước không tải lại trang,
// giá/tồn kho/SKU cập nhật tức thì, thêm giỏ / mua ngay đúng biến thể. Lựa chọn đồng bộ với trang chi tiết qua ?color=&size=.
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReviewCard from '@/components/account/ReviewCard';
import ProductCard from '@/components/product/ProductCard';
import Rotator360, { warmFrames } from '@/components/product/Rotator360';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Button, { LinkButton } from '@/components/ui/Button';
import ColorSwatch from '@/components/ui/ColorSwatch';
import Icon from '@/components/ui/Icon';
import QuantityStepper from '@/components/ui/QuantityStepper';
import StarRating from '@/components/ui/StarRating';
import { EmptyState, ErrorState, PageSkeleton, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useCartActions, useWishlist } from '@/hooks/useCart';
import { useProduct } from '@/hooks/useProducts';
import { cn } from '@/lib/cn';
import { discountPercent, formatCurrency } from '@/lib/format';
import {
  findVariant,
  nearestInStockSize,
  parseVariantQuery,
  uniqueColors,
  uniqueSizes,
  variantQuery,
} from '@/lib/variant';
import { ApiClientError } from '@/services/api-client';
import { productApi } from '@/services/product.api';
import { toast } from '@/store/uiStore';
import type { Product360Variant } from '@/types/api';

type TabKey = 'desc' | 'specs' | 'policies' | 'reviews' | 'qa';
const eff = (v: Product360Variant) => v.salePrice ?? v.price;

export default function Product360Page() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const q = useQuery({ queryKey: ['p360', slug], queryFn: () => productApi.view360(slug) });
  const wl = useWishlist();
  const { addToCart, adding } = useCartActions();
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tab, setTab] = useState<TabKey>('desc');
  const tabsRef = useRef<HTMLDivElement>(null);
  const d = q.data;
  const p = d?.product;

  // ----- Khởi tạo lựa chọn từ URL (?color=&size=) hoặc biến thể mặc định -----
  useEffect(() => {
    if (!d) return;
    const fromUrl = parseVariantQuery(d.variants, window.location.search);
    const def = d.variants.find((v) => v.id === d.product.defaultVariantId) ?? d.variants[0];
    const c = fromUrl.color ?? def?.color?.name ?? d.defaultColor;
    let s = fromUrl.size ?? def?.size ?? null;
    if ((findVariant(d.variants, c, s)?.stockQuantity ?? 0) <= 0)
      s = nearestInStockSize(d.variants, c, s) ?? s;
    setColor(c);
    setSize(s);
    setPlaying(d.autoRotate);
    setFrame(0);
    setQty(1);
    // eslint-disable-next-line
  }, [d?.productId]);

  const variants = useMemo(() => d?.variants ?? [], [d]);
  const colors = useMemo(() => uniqueColors(variants), [variants]);
  const sizes = useMemo(() => uniqueSizes(variants), [variants]);
  const showSizes = sizes.length > 1 || (sizes.length === 1 && sizes[0] !== 'Tiêu chuẩn');
  const variant = findVariant(variants, color, size);
  const colorData = d?.colors.find((c) => c.name === color) ?? d?.colors[0];
  const stock = variant?.stockQuantity ?? 0;
  const colorOut = (name: string) => !variants.some((v) => v.color?.name === name && v.stockQuantity > 0);

  // cập nhật URL bằng replaceState (không thêm lịch sử, không fetch lại trang)
  const syncUrl = useCallback((c: string | null, s: string | null) => {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${variantQuery(c, s)}`);
  }, []);

  const pickColor = (name: string) => {
    if (name === color) return;
    let s = size;
    if ((findVariant(variants, name, s)?.stockQuantity ?? 0) <= 0) {
      const near = nearestInStockSize(variants, name, s);
      if (near && near !== s) {
        toast.info(`Kích thước ${s} đã hết hàng ở màu ${name}, đã chuyển sang ${near}.`);
        s = near;
      }
    }
    setColor(name);
    setSize(s);
    setQty(1);
    syncUrl(name, s);
  };
  const pickSize = (label: string) => {
    if (label === size) return;
    setSize(label);
    setQty((n) => Math.min(n, Math.max(1, findVariant(variants, color, label)?.stockQuantity ?? 1)));
    syncUrl(color, label);
  };

  // tải ngầm khung hình các màu khác khi rảnh
  useEffect(() => {
    if (!d) return;
    d.colors.filter((c) => c.name !== color).forEach((c) => warmFrames(c.frames, frame));
    // eslint-disable-next-line
  }, [d?.productId]);

  const reviews = useQuery({
    queryKey: ['reviews', slug, 1, 0],
    queryFn: () => productApi.reviews(slug, { page: 1 }),
    enabled: Boolean(d),
  });
  const questions = useQuery({
    queryKey: ['questions', slug],
    queryFn: () => productApi.questions(slug),
    enabled: Boolean(d),
  });
  const related = useQuery({
    queryKey: ['related', slug],
    queryFn: () => productApi.related(slug),
    enabled: Boolean(d),
  });
  const detail = useProduct(slug); // dùng khi không có 360° để gợi ý chuyển sang 3D

  if (q.isLoading)
    return (
      <div className="container-page py-8">
        <Skeleton className="mb-4 h-8 w-1/2" />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Skeleton className="h-[520px] w-full" />
          <PageSkeleton />
        </div>
      </div>
    );
  if (q.isError) {
    const nf = q.error instanceof ApiClientError && q.error.status === 404;
    return (
      <div className="container-page py-10">
        {nf ? (
          <EmptyState
            icon="rotate"
            title="Sản phẩm này chưa có ảnh 360°"
            description="Bạn vẫn có thể xem ảnh và thông tin chi tiết của sản phẩm."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href={`/products/${slug}`}>Quay lại chi tiết sản phẩm</LinkButton>
                {detail.data?.model && (
                  <LinkButton href={`/products/${slug}/3d`} variant="outline">
                    Xem mô hình 3D
                  </LinkButton>
                )}
              </div>
            }
          />
        ) : (
          <ErrorState onRetry={() => q.refetch()} />
        )}
      </div>
    );
  }
  if (!d || !p || !colorData || !variant)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );

  const price = eff(variant);
  const original = variant.salePrice ? variant.price : null;
  const pct = discountPercent(price, original);
  const label = [variant.color?.name, size && size !== 'Tiêu chuẩn' ? size : null].filter(Boolean).join(', ');
  const backHref = `/products/${slug}${variantQuery(color, size)}`;
  const dim = variant.dimensionsCm;
  const stockText =
    stock <= 0 ? 'Hết hàng' : stock <= 5 ? `Sắp hết hàng – còn ${stock} sản phẩm` : `Còn ${stock} sản phẩm`;

  const add = () => addToCart(variant.id, qty, `Đã thêm ${p.name} – ${label} vào giỏ`);
  const buyNow = async () => {
    const cart = await add();
    const item = cart?.items.find((i) => i.variantId === variant.id);
    if (item) router.push(`/checkout?items=${item.id}`);
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/products/${slug}/360${variantQuery(color, size)}`,
      );
      toast.success('Đã sao chép liên kết (kèm màu và kích thước đang chọn).');
    } catch {
      toast.info(window.location.href);
    }
  };
  const gotoTab = (t: TabKey) => {
    setTab(t);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const specs: Array<[string, string]> = [
    ['Kích thước (D × R × C)', `${dim.length} × ${dim.width} × ${dim.height} cm`],
    ['Chất liệu', variant.material ?? p.material ?? '—'],
    ['Màu sắc', variant.color?.name ?? '—'],
    ...(showSizes ? ([['Phiên bản', size ?? '—']] as Array<[string, string]>) : []),
    ['Trọng lượng', variant.weightKg ? `${variant.weightKg} kg` : '—'],
    ['Mã SKU', variant.sku],
    ...p.specs
      .filter((s) => ['Phong cách', 'Thương hiệu', 'Xuất xứ', 'Bảo hành'].includes(s.label))
      .map((s) => [s.label, s.value] as [string, string]),
    [
      'Tải trọng',
      ['sofa', 'bed', 'chair'].some((k) => p.name.toLowerCase().includes(k)) ||
      /sofa|giường|ghế/i.test(p.name)
        ? 'Tối đa 300 kg'
        : /bàn|tủ/i.test(p.name)
          ? 'Tối đa 120 kg'
          : '—',
    ],
  ];

  const priceBlock = (
    <div className="flex flex-wrap items-baseline gap-3">
      <span
        className={cn('text-3xl font-extrabold', original ? 'text-danger' : 'text-ink')}
        data-testid="price"
      >
        {formatCurrency(price)}
      </span>
      {original && <span className="text-lg text-muted line-through">{formatCurrency(original)}</span>}
      {pct > 0 && <span className="rounded bg-danger px-2 py-0.5 text-sm font-bold text-white">-{pct}%</span>}
    </div>
  );

  return (
    <div className="container-page pb-28 pt-4 sm:pb-12">
      {/* Thanh trên */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label="Quay lại trang chi tiết sản phẩm"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white hover:bg-surface-muted"
          >
            <Icon name="arrowLeft" size={18} />
          </Link>
          <div className="hidden min-w-0 sm:block">
            <Breadcrumb
              items={[
                { label: 'Trang chủ', href: '/' },
                { label: 'Sản phẩm', href: '/products' },
                ...(p.category
                  ? [{ label: p.category.name, href: `/products?category=${p.category.slug}` }]
                  : []),
                { label: p.name, href: backHref },
                { label: 'Xem 360°' },
              ]}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={share}>
            <Icon name="share" size={15} /> Chia sẻ
          </Button>
          <Button variant="outline" size="sm" aria-pressed={wl.has(slug)} onClick={() => wl.toggle(slug)}>
            <Icon
              name="heart"
              size={15}
              filled={wl.has(slug)}
              className={wl.has(slug) ? 'text-danger' : ''}
            />{' '}
            {wl.has(slug) ? 'Đã yêu thích' : 'Yêu thích'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Cột trái: khung xoay */}
        <div>
          <div className="overflow-hidden rounded-card border border-line">
            <Rotator360
              frames={colorData.frames}
              frame={frame}
              onFrame={setFrame}
              playing={playing}
              onPlaying={setPlaying}
              speed={d.rotationSpeed * 0.75}
              alt={`${p.name} màu ${colorData.name}`}
              className="h-[60vh] min-h-[360px] lg:h-[600px]"
              overlay={
                <div
                  className="pointer-events-none absolute right-3 top-3 rounded-card bg-white/95 px-3 py-2 text-xs shadow"
                  data-testid="dims"
                >
                  <p className="font-bold">Kích thước (D × R × C)</p>
                  <p>
                    {dim.length} × {dim.width} × {dim.height} cm
                  </p>
                </div>
              }
            />
          </div>
          <div
            className="mt-3 flex items-center gap-3 overflow-x-auto pb-1"
            role="radiogroup"
            aria-label="Chọn màu nhanh"
          >
            {d.colors.map((c) => {
              const out = colorOut(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={c.name === color}
                  aria-label={`Màu ${c.name}${out ? ' (hết hàng)' : ''}`}
                  title={out ? 'Hết hàng' : c.name}
                  disabled={out}
                  onMouseEnter={() => warmFrames(c.frames, frame)}
                  onClick={() => pickColor(c.name)}
                  className={cn(
                    'w-24 shrink-0 overflow-hidden rounded-md border-2 bg-surface-muted text-center transition',
                    c.name === color ? 'border-primary' : 'border-transparent hover:border-line',
                    out && 'opacity-40',
                  )}
                >
                  <img src={c.thumbnail} alt="" draggable={false} className="h-16 w-full object-cover" />
                  <span className="block py-0.5 text-xs font-medium">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cột phải: thông tin (sticky) */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <button type="button" onClick={() => gotoTab('reviews')} className="flex items-center gap-2">
                <StarRating value={p.ratingAvg} size={15} showValue />
                <span className="text-muted underline-offset-2 hover:underline">
                  ({p.ratingCount} đánh giá)
                </span>
              </button>
              <span className="text-muted">
                SKU:{' '}
                <b className="text-ink" data-testid="sku">
                  {variant.sku}
                </b>
              </span>
            </div>
          </div>
          {priceBlock}

          <div>
            <p className="mb-2 text-sm font-semibold">
              Màu sắc:{' '}
              <span className="font-normal text-muted" data-testid="color-name">
                {color}
              </span>
            </p>
            <div className="flex flex-wrap gap-3">
              {colors.map((c) => {
                const out = colorOut(c.name);
                return (
                  <span key={c.name} className={cn(out && 'opacity-40')}>
                    <ColorSwatch
                      hex={c.hex}
                      name={out ? `${c.name} – Hết hàng` : c.name}
                      size={32}
                      selected={c.name === color}
                      onClick={out ? undefined : () => pickColor(c.name)}
                    />
                  </span>
                );
              })}
            </div>
          </div>

          {showSizes && (
            <div>
              <p className="mb-2 text-sm font-semibold">Kích thước</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn kích thước">
                {sizes.map((s) => {
                  const v = findVariant(variants, color, s);
                  const out = !v || v.stockQuantity <= 0;
                  const diff = v && v !== variant ? eff(v) - price : 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={s === size}
                      disabled={out}
                      title={out ? 'Hết hàng' : s}
                      onClick={() => pickSize(s)}
                      className={cn(
                        'rounded-btn border px-4 py-2 text-left text-sm font-medium transition',
                        s === size
                          ? 'border-primary bg-primary text-white'
                          : 'border-line bg-white hover:border-primary',
                        out &&
                          'cursor-not-allowed bg-surface-muted/50 text-muted line-through opacity-50 hover:border-line',
                      )}
                    >
                      {s}
                      {!out && diff !== 0 && (
                        <span
                          className={cn(
                            'block text-[11px] font-normal',
                            s === size ? 'text-white/80' : 'text-muted',
                          )}
                        >
                          {diff > 0 ? '+' : '−'}
                          {formatCurrency(Math.abs(diff))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p
            className={cn(
              'text-sm font-medium',
              stock <= 0 ? 'text-danger' : stock <= 5 ? 'text-amber-600' : 'text-emerald-600',
            )}
            data-testid="stock"
            role="status"
          >
            {stockText}
          </p>

          <div className="flex items-center gap-3">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Số lượng</p>
              <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, stock)} />
            </div>
          </div>
          <div className="hidden gap-3 sm:flex">
            <Button size="lg" className="flex-1" loading={adding} disabled={stock <= 0} onClick={add}>
              <Icon name="cart" size={18} /> Thêm vào giỏ hàng
            </Button>
            <Button size="lg" variant="outline" className="flex-1" disabled={stock <= 0} onClick={buyNow}>
              Mua ngay
            </Button>
          </div>
          <ul className="grid grid-cols-3 gap-3 border-y border-line py-4">
            {[
              ['truck', 'Giao hàng toàn quốc', '2–5 ngày'],
              ['refresh', 'Đổi trả', 'trong 7 ngày'],
              ['shield', 'Bảo hành', '12 tháng'],
            ].map(([ic, t, s]) => (
              <li key={t} className="flex flex-col items-center gap-1 text-center text-xs">
                <Icon name={ic as 'truck'} size={22} className="text-primary" />
                <span className="font-semibold">{t}</span>
                <span className="text-muted">{s}</span>
              </li>
            ))}
          </ul>
          <LinkButton
            href={`/products/${slug}/3d`}
            variant="ghost"
            size="sm"
            className={d.product.model ? '' : 'hidden'}
          >
            <Icon name="cube" size={15} /> Xem mô hình 3D
          </LinkButton>
        </aside>
      </div>

      {/* Thông tin chi tiết */}
      <section ref={tabsRef} className="mt-12 scroll-mt-20">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'desc', label: 'Mô tả sản phẩm' },
            { key: 'specs', label: 'Thông số kỹ thuật' },
            { key: 'policies', label: 'Chính sách' },
            { key: 'reviews', label: `Đánh giá (${p.ratingCount})` },
            { key: 'qa', label: `Hỏi đáp (${p.questionCount})` },
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
          {tab === 'specs' && (
            <div>
              <p className="mb-3 text-sm text-muted">
                Thông số theo biến thể đang chọn: <b className="text-ink">{label}</b>
              </p>
              <dl
                className="max-w-2xl divide-y divide-line overflow-hidden rounded-card border border-line bg-white text-sm"
                data-testid="specs"
              >
                {specs.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[180px_1fr] gap-4 px-4 py-3 odd:bg-surface-muted/40">
                    <dt className="font-medium text-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {tab === 'policies' && (
            <div className="grid gap-4 md:grid-cols-2" data-testid="policies">
              {d.policies.map((pl) => (
                <article key={pl.key} className="card p-5">
                  <h3 className="flex items-center gap-2 font-bold">
                    <Icon
                      name={
                        pl.key === 'shipping'
                          ? 'truck'
                          : pl.key === 'returns'
                            ? 'refresh'
                            : pl.key === 'warranty'
                              ? 'shield'
                              : 'wallet'
                      }
                      size={18}
                      className="text-primary"
                    />{' '}
                    {pl.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted">{pl.summary}</p>
                  <Link
                    href={pl.href}
                    className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                  >
                    Xem chi tiết →
                  </Link>
                </article>
              ))}
            </div>
          )}
          {tab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 rounded-card bg-surface-muted/60 p-5">
                <p className="text-4xl font-extrabold text-primary">{p.ratingAvg.toFixed(1)}</p>
                <div>
                  <StarRating value={p.ratingAvg} size={18} />
                  <p className="text-sm text-muted">{p.ratingCount} đánh giá</p>
                </div>
              </div>
              {reviews.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : reviews.data?.items.length ? (
                reviews.data.items.slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} />)
              ) : (
                <p className="text-sm text-muted">Chưa có đánh giá.</p>
              )}
              <Link
                href={`/products/${slug}`}
                className="inline-block text-sm font-semibold text-primary hover:underline"
              >
                Xem tất cả đánh giá →
              </Link>
            </div>
          )}
          {tab === 'qa' && (
            <div className="space-y-3">
              {questions.data?.length ? (
                questions.data.slice(0, 5).map((x) => (
                  <article key={x.id} className="card p-4 text-sm">
                    <p className="font-semibold">{x.content}</p>
                    {x.answer && (
                      <p className="mt-2 rounded bg-surface-muted/70 p-2 text-muted">{x.answer}</p>
                    )}
                  </article>
                ))
              ) : (
                <p className="text-sm text-muted">Chưa có câu hỏi nào được trả lời.</p>
              )}
              <Link
                href={`/products/${slug}`}
                className="inline-block text-sm font-semibold text-primary hover:underline"
              >
                Đặt câu hỏi cho cửa hàng →
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-5 text-xl font-extrabold uppercase">Sản phẩm liên quan</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {related.data?.map((x) => (
            <ProductCard key={x.id} product={x} />
          ))}
        </div>
      </section>

      {/* Thanh dưới cố định trên mobile */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-4px_14px_rgba(43,30,22,0.08)] sm:hidden"
        data-testid="mobile-bar"
      >
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-danger">{formatCurrency(price)}</p>
          <p className="truncate text-xs text-muted">
            {label} · {stock > 0 ? 'Còn hàng' : 'Hết hàng'}
          </p>
        </div>
        <Button variant="outline" disabled={stock <= 0} onClick={buyNow}>
          Mua ngay
        </Button>
        <Button loading={adding} disabled={stock <= 0} onClick={add}>
          <Icon name="cart" size={16} /> Thêm vào giỏ
        </Button>
      </div>
    </div>
  );
}
