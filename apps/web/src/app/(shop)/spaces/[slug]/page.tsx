'use client';

// Chi tiết không gian mẫu (WIREFRAME 7.6): viewer 360° + hotspot | sản phẩm trong không gian + tổng giá thật (đặc tả không có giá combo)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import SpaceCard from '@/components/product/SpaceCard';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/hooks/useCart';
import { useSpace } from '@/hooks/useSpaces';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { getVisitorId } from '@/lib/visitor';
import { roomTypeLabel } from '@/lib/status';
import { ApiClientError } from '@/services/api-client';
import { cartApi } from '@/services/cart.api';
import { spaceApi } from '@/services/space.api';
import { toast } from '@/store/uiStore';
import type { PlacementOverride } from '@/components/viewer/SpacePanorama';
import type { PanoramaView, PlacementView } from '@/types/api';

const SpacePanorama = dynamic(() => import('@/components/viewer/SpacePanorama'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-ink text-white/70">
      Đang tải ảnh 360°…
    </div>
  ),
});
type Hotspot = PanoramaView['hotspots'][number];

export default function SpaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const q = useSpace(slug);
  const s = q.data;
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [panoId, setPanoId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  // UC-SPACE-05: món đang chọn trong ảnh và các món "Đổi món" thử (chỉ ở client, KHÔNG lưu)
  const [placement, setPlacement] = useState<PlacementView | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swaps, setSwaps] = useState<Record<number, PlacementOverride & { slug: string }>>({});
  const alternatives = useQuery({
    queryKey: ['space-alternatives', slug, placement?.id],
    queryFn: () => spaceApi.alternatives(slug, placement!.id),
    enabled: Boolean(placement) && swapOpen,
    staleTime: 60_000,
  });
  const search = useSearchParams();

  useEffect(() => {
    if (!s) return;
    setPanoId(s.panoramas.find((p) => p.isStart)?.id ?? s.panoramas[0]?.id ?? null);
    setChecked(s.products.map((p) => p.id));
  }, [s?.id]);

  // Lượt xem (UC-SPACE-06): gom số lần bấm hotspot + cờ đã thêm vào giỏ, rồi gửi ĐÚNG MỘT lần khi rời trang
  // (tab ẩn / pagehide / chuyển trang trong ứng dụng) bằng sendBeacon. ?from=<slug sản phẩm> là sản phẩm dẫn tới.
  const stats = useRef({ clicks: 0, added: false, sent: false });
  const from = search.get('from') ?? undefined;
  useEffect(() => {
    if (!s) return;
    stats.current = { clicks: 0, added: false, sent: false };
    const send = () => {
      const st = stats.current;
      if (st.sent) return;
      st.sent = true;
      spaceApi.sendViewBeacon(slug, {
        visitorId: getVisitorId(),
        sourceProductId: from,
        hotspotClickCount: st.clicks,
        addedToCart: st.added,
      });
    };
    const onHide = () => document.visibilityState === 'hidden' && send();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', send);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', send);
      send(); // rời trang bằng điều hướng trong ứng dụng (không có pagehide)
    };
  }, [s?.id]);

  const pano = s?.panoramas.find((p) => p.id === panoId) ?? s?.panoramas[0];
  const chosen = useMemo(() => s?.products.filter((p) => checked.includes(p.id)) ?? [], [s, checked]);
  const original = chosen.reduce((sum, p) => sum + (p.salePrice ?? p.price), 0);

  const addAll = useMutation({
    // MỘT request tới POST /spaces/:slug/add-to-cart (transaction ở BE): có món hết hàng thì KHÔNG món nào được thêm
    mutationFn: () =>
      spaceApi.addToCart(
        slug,
        chosen.map((p) => p.id),
      ),
    onSuccess: ({ cart }) => {
      qc.setQueryData(queryKeys.cart, cart);
      stats.current.added = true;
      toast.success(`Đã thêm ${chosen.length} sản phẩm vào giỏ hàng.`);
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'CONFLICT') {
        const list = (e.details?.unavailable as Array<{ name?: string; reason?: string }> | undefined) ?? [];
        toast.error(
          list.length
            ? `Chưa thêm sản phẩm nào vào giỏ. ${list.map((u) => `${u.name ?? 'Sản phẩm'}: ${u.reason ?? 'không thể thêm'}`).join('; ')}`
            : e.message,
        );
        return;
      }
      toast.error(e instanceof ApiClientError ? e.message : 'Không thể thêm vào giỏ hàng.');
    },
  });
  const bookmark = useMutation({
    mutationFn: () => (s!.isBookmarked ? spaceApi.unbookmark(s!.slug) : spaceApi.bookmark(s!.slug)),
    onSuccess: () => {
      toast.success(s!.isBookmarked ? 'Đã bỏ lưu không gian.' : 'Đã lưu không gian mẫu.');
      qc.invalidateQueries({ queryKey: ['space', slug] });
    },
  });

  if (q.isLoading)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (q.isError) {
    const nf = q.error instanceof ApiClientError && q.error.status === 404;
    return (
      <div className="container-page py-8">
        {nf ? (
          <EmptyState
            icon="image"
            title="Không tìm thấy không gian mẫu"
            action={<LinkButton href="/spaces">Xem không gian khác</LinkButton>}
          />
        ) : (
          <ErrorState onRetry={() => q.refetch()} />
        )}
      </div>
    );
  }
  if (!s || !pano) return null;

  const onHotspot = (h: Hotspot) => {
    stats.current.clicks += 1;
    if (h.type === 'navigation' && h.targetPanoramaId) {
      setPanoId(h.targetPanoramaId);
      setSelected(null);
      setPlacement(null);
    } else {
      setSelected(h);
      setPlacement(null);
    }
  };
  const onPlacement = (p: PlacementView) => {
    setSelected(null);
    setSwapOpen(false);
    setPlacement(p);
  };
  const firstModelProduct = s.products.find((p) => p.has3dModel);

  const swap = placement ? swaps[placement.id] : undefined;
  const placementPopover = placement && (
    <div
      className="absolute bottom-16 left-4 z-30 w-[min(92%,340px)] rounded-card bg-white p-3 shadow-xl"
      role="dialog"
      aria-label="Món đặt trong không gian"
      data-testid="placement-popover"
    >
      <button
        type="button"
        aria-label="Đóng"
        onClick={() => {
          setPlacement(null);
          setSwapOpen(false);
        }}
        className="absolute right-2 top-2 text-muted hover:text-ink"
      >
        <Icon name="close" size={16} />
      </button>
      <p className="pr-5 text-sm font-bold" data-testid="placement-name">
        {swap?.name ?? placement.product?.name ?? 'Sản phẩm'}
      </p>
      {swap && <p className="text-xs text-primary">Đang xem thử — không được lưu lại</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setSwapOpen((o) => !o)} aria-expanded={swapOpen}>
          Đổi món
        </Button>
        <LinkButton
          size="sm"
          variant="ghost"
          href={`/products/${swap?.slug ?? placement.product?.slug ?? ''}`}
        >
          Xem sản phẩm
        </LinkButton>
        {swap && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSwaps((m) => {
                const { [placement.id]: _drop, ...rest } = m;
                void _drop;
                return rest;
              })
            }
          >
            Về món gốc
          </Button>
        )}
      </div>
      {swapOpen && (
        <div className="mt-3" data-testid="alternatives">
          {alternatives.isLoading && <p className="text-xs text-muted">Đang tìm món cùng loại…</p>}
          {alternatives.isError && (
            <p role="alert" className="text-xs text-danger">
              Không tải được danh sách món. Vui lòng thử lại.
            </p>
          )}
          {alternatives.data && alternatives.data.length === 0 && (
            <p className="text-xs text-muted">Chưa có món cùng loại có mô hình 3D.</p>
          )}
          <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto">
            {alternatives.data?.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  data-testid={`alt-${a.id}`}
                  onClick={() => {
                    setSwaps((m) => ({
                      ...m,
                      [placement.id]: {
                        productId: a.id,
                        name: a.name,
                        slug: a.slug,
                        variantId: a.variantId,
                        model: a.model,
                      },
                    }));
                    setSwapOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md border border-line p-1.5 text-left text-sm hover:border-primary"
                >
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-muted">
                    {a.thumbnailUrl && (
                      <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 font-semibold">{a.name}</span>
                    <span className="text-xs text-danger">{formatCurrency(a.salePrice ?? a.price)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const popover = selected && (
    <div
      className="absolute bottom-16 left-4 z-30 w-[min(86%,300px)] rounded-card bg-white p-3 shadow-xl"
      role="dialog"
      aria-label="Thông tin điểm tương tác"
    >
      <button
        type="button"
        aria-label="Đóng"
        onClick={() => setSelected(null)}
        className="absolute right-2 top-2 text-muted hover:text-ink"
      >
        <Icon name="close" size={16} />
      </button>
      {selected.type === 'product' && selected.product ? (
        <div className="flex gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
            {selected.product.thumbnailUrl && (
              <img src={selected.product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 pr-5 text-sm font-bold">{selected.product.name}</p>
            <p className="text-sm font-extrabold text-danger">
              {formatCurrency(selected.product.salePrice ?? selected.product.price)}
            </p>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!user) {
                    toast.info('Vui lòng đăng nhập để thêm vào giỏ hàng.');
                    router.push(`/login?next=/spaces/${slug}`);
                    return;
                  }
                  try {
                    const c = await cartApi.addItem({
                      variantId: selected.product!.defaultVariantId,
                      quantity: 1,
                    });
                    qc.setQueryData(queryKeys.cart, c);
                    stats.current.added = true;
                    toast.success('Đã thêm vào giỏ hàng.');
                  } catch (e) {
                    toast.error(e instanceof ApiClientError ? e.message : 'Không thể thêm vào giỏ.');
                  }
                }}
                className="rounded-btn bg-primary px-3 py-1 text-xs font-semibold text-white"
              >
                Thêm
              </button>
              <Link
                href={`/products/${selected.product.slug}`}
                className="rounded-btn border border-primary px-3 py-1 text-xs font-semibold text-primary"
              >
                Xem
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="pr-5 text-sm font-bold">{selected.title ?? 'Thông tin'}</p>
          <p className="mt-1 text-sm text-muted">{selected.content}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="container-page py-6">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Không gian mẫu', href: '/spaces' },
          { label: s.title },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        <div>
          <div className="aspect-[16/10] overflow-hidden rounded-card border border-line">
            <SpacePanorama
              key={pano.id}
              panorama={pano}
              onSelect={onHotspot}
              selectedId={selected?.id}
              overlay={popover || placementPopover}
              placements={pano.placements}
              overrides={swaps}
              selectedPlacementId={placement?.id ?? null}
              onSelectPlacement={onPlacement}
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {s.panoramas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPanoId(p.id);
                  setSelected(null);
                  setPlacement(null);
                }}
                aria-current={p.id === pano.id}
                className={cn(
                  'h-16 w-24 shrink-0 overflow-hidden rounded-md border-2',
                  p.id === pano.id ? 'border-primary' : 'border-transparent',
                )}
              >
                <img src={p.url} alt={p.title ?? 'Góc chụp'} className="h-full w-full object-cover" />
              </button>
            ))}
            {firstModelProduct && (
              <Link
                href={`/products/${firstModelProduct.slug}/3d`}
                className="flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary-soft text-primary"
                aria-label="Xem 3D sản phẩm trong không gian"
              >
                <Icon name="cube" size={20} />
                <span className="text-xs font-bold">Xem 3D</span>
              </Link>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div>
            <div className="flex flex-wrap gap-2">
              {s.style && (
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  {s.style}
                </span>
              )}
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold">
                {roomTypeLabel[s.roomType]}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold">{s.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Icon name="eye" size={15} /> {s.viewCount.toLocaleString('vi-VN')} lượt xem
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{s.description}</p>
          </div>
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Sản phẩm trong không gian ({s.products.length})</h2>
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() =>
                  setChecked(checked.length === s.products.length ? [] : s.products.map((p) => p.id))
                }
              >
                {checked.length === s.products.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>
            <ul className="divide-y divide-line">
              {s.products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${p.name}`}
                    checked={checked.includes(p.id)}
                    onChange={() =>
                      setChecked((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <Link
                    href={`/products/${p.slug}`}
                    className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-muted"
                  >
                    {p.thumbnailUrl && (
                      <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${p.slug}`}
                      className="line-clamp-1 text-sm font-semibold hover:text-primary"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {p.colors[0]?.name}
                      {p.sizes[0] && p.sizes[0] !== 'Tiêu chuẩn' ? ` · ${p.sizes[1] ?? p.sizes[0]}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(p.salePrice ?? p.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-sm">
              <span className="font-semibold">Tổng cộng ({chosen.length} sản phẩm)</span>
              <span className="text-xl font-extrabold text-danger">{formatCurrency(original)}</span>
            </div>
            <Button
              block
              size="lg"
              className="mt-3"
              loading={addAll.isPending}
              disabled={!chosen.length}
              onClick={() =>
                user
                  ? addAll.mutate()
                  : (toast.info('Vui lòng đăng nhập để thêm vào giỏ hàng.'),
                    router.push(`/login?next=/spaces/${slug}`))
              }
            >
              <Icon name="cart" size={18} /> Thêm cả bộ vào giỏ hàng
            </Button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  user
                    ? bookmark.mutate()
                    : (toast.info('Vui lòng đăng nhập để lưu không gian.'),
                      router.push(`/login?next=/spaces/${slug}`))
                }
              >
                <Icon
                  name="heart"
                  size={16}
                  filled={s.isBookmarked}
                  className={s.isBookmarked ? 'text-danger' : ''}
                />{' '}
                {s.isBookmarked ? 'Đã lưu' : 'Lưu không gian'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success('Đã sao chép liên kết.');
                  } catch {
                    toast.info(window.location.href);
                  }
                }}
              >
                <Icon name="share" size={16} /> Chia sẻ
              </Button>
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-12">
        <h2 className="mb-5 text-xl font-extrabold uppercase">Không gian tương tự</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {s.similar.map((x) => (
            <SpaceCard key={x.id} space={x} />
          ))}
        </div>
      </section>
    </div>
  );
}
