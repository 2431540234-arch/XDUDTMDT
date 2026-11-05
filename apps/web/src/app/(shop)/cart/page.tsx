'use client';

// Giỏ hàng (WIREFRAME 2.4) và giỏ hàng trống (7.15)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import QuantityStepper from '@/components/ui/QuantityStepper';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import ProductCard from '@/components/product/ProductCard';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys, useCartActions, useCartQuery } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/format';
import { getRecent, type RecentProduct } from '@/lib/recent';
import { errorMessage } from '@/lib/validators';
import { cartApi } from '@/services/cart.api';
import { productApi } from '@/services/product.api';
import { toast } from '@/store/uiStore';

function EmptyCart() {
  const [recent, setRecent] = useState<RecentProduct[]>([]);
  useEffect(() => setRecent(getRecent()), []);
  const suggest = useQuery({
    queryKey: ['cart-suggest'],
    queryFn: () => productApi.list({ featured: true, pageSize: 4 }),
  });
  return (
    <div>
      <div className="card mx-auto max-w-2xl px-6 py-12 text-center">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-surface-muted text-primary">
          <Icon name="cart" size={44} />
        </div>
        <h1 className="text-2xl font-extrabold">Giỏ hàng của bạn đang trống</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Hãy khám phá bộ sưu tập nội thất hiện đại và thêm những món đồ yêu thích vào giỏ hàng.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href="/products" size="lg">
            Khám phá sản phẩm <Icon name="arrowRight" size={16} />
          </LinkButton>
          <LinkButton href="/spaces" size="lg" variant="outline">
            Xem không gian mẫu
          </LinkButton>
        </div>
      </div>
      <section className="mt-12">
        <h2 className="mb-5 text-xl font-extrabold uppercase">Có thể bạn sẽ thích</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {suggest.data?.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-extrabold uppercase">Sản phẩm đã xem gần đây</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((r) => (
              <Link
                key={r.slug}
                href={`/products/${r.slug}`}
                className="card overflow-hidden p-2 text-center hover:shadow-lg"
              >
                <div className="aspect-square overflow-hidden rounded-md bg-surface-muted">
                  {r.thumbnailUrl && (
                    <img src={r.thumbnailUrl} alt={r.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="mt-2 line-clamp-1 text-xs font-semibold">{r.name}</p>
                <p className="text-xs font-bold text-primary">{formatCurrency(r.price)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function CartPage() {
  const { user, hydrated } = useAuth();
  const q = useCartQuery();
  const qc = useQueryClient();
  const { update, remove } = useCartActions();
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');

  const apply = useMutation({
    mutationFn: () => cartApi.applyCoupon(code.trim()),
    onSuccess: (c) => {
      qc.setQueryData(queryKeys.cart, c);
      setCodeErr('');
      setCode('');
      toast.success('Đã áp dụng mã giảm giá.');
    },
    onError: (e) => setCodeErr(errorMessage(e)),
  });
  const unapply = useMutation({
    mutationFn: cartApi.removeCoupon,
    onSuccess: (c) => qc.setQueryData(queryKeys.cart, c),
  });

  if (!hydrated)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (!user) {
    return (
      <div className="container-page py-8">
        <EmptyState
          icon="user"
          title="Vui lòng đăng nhập để xem giỏ hàng"
          description="Khách vãng lai chỉ có thể xem sản phẩm. Đăng nhập để thêm sản phẩm vào giỏ và đặt hàng."
          action={<LinkButton href="/login?next=/cart">Đăng nhập</LinkButton>}
        />
      </div>
    );
  }
  if (q.isLoading)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (q.isError)
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => q.refetch()} />
      </div>
    );
  const cart = q.data!;

  return (
    <div className="container-page py-6">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Giỏ hàng' }]} />
      {cart.items.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <h1 className="mb-5 text-2xl font-extrabold">Giỏ hàng của bạn ({cart.itemCount} sản phẩm)</h1>
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="hidden bg-surface-muted/60 text-left text-xs font-semibold uppercase text-muted sm:table-header-group">
                    <tr>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3">Đơn giá</th>
                      <th className="px-4 py-3">Số lượng</th>
                      <th className="px-4 py-3">Thành tiền</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {cart.items.map((it) => (
                      <tr key={it.id} className="block p-4 sm:table-row sm:p-0">
                        <td className="block sm:table-cell sm:px-4 sm:py-4">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/products/${it.productSlug}`}
                              className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-surface-muted"
                            >
                              {it.imageUrl && (
                                <img
                                  src={it.imageUrl}
                                  alt={it.productName}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </Link>
                            <div>
                              <Link
                                href={`/products/${it.productSlug}`}
                                className="font-semibold hover:text-primary"
                              >
                                {it.productName}
                              </Link>
                              <p className="text-xs text-muted">Phân loại: {it.variantLabel}</p>
                              {it.quantity > it.stockQuantity && (
                                <p className="text-xs text-danger">Chỉ còn {it.stockQuantity} sản phẩm</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="block py-2 sm:table-cell sm:px-4">
                          <span className="font-semibold">{formatCurrency(it.unitPrice)}</span>
                          {it.originalPrice > it.unitPrice && (
                            <span className="block text-xs text-muted line-through">
                              {formatCurrency(it.originalPrice)}
                            </span>
                          )}
                        </td>
                        <td className="block sm:table-cell sm:px-4">
                          <QuantityStepper
                            size="sm"
                            value={it.quantity}
                            max={Math.max(1, it.stockQuantity)}
                            onChange={(quantity) => update.mutate({ id: it.id, quantity })}
                          />
                        </td>
                        <td className="block py-2 font-bold sm:table-cell sm:px-4">
                          {formatCurrency(it.lineTotal)}
                        </td>
                        <td className="block sm:table-cell sm:px-4 sm:text-right">
                          <button
                            type="button"
                            aria-label={`Xóa ${it.productName}`}
                            onClick={() => remove.mutate(it.id)}
                            className="rounded p-2 text-muted hover:bg-rose-50 hover:text-danger"
                          >
                            <Icon name="trash" size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                href="/products"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <Icon name="arrowLeft" size={16} /> Tiếp tục mua sắm
              </Link>
            </div>

            <aside className="card h-fit space-y-3 p-5 text-sm">
              <h2 className="text-lg font-extrabold">Tổng tiền giỏ hàng</h2>
              <div className="flex justify-between">
                <span className="text-muted">Tạm tính ({cart.itemCount} sản phẩm)</span>
                <span className="font-semibold">{formatCurrency(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Giảm giá{cart.coupon ? ` (${cart.coupon.code})` : ''}</span>
                <span className="font-semibold text-danger">
                  {cart.discountAmount ? `-${formatCurrency(cart.discountAmount)}` : formatCurrency(0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Phí vận chuyển</span>
                <span className="font-semibold">
                  {cart.shippingFee ? formatCurrency(cart.shippingFee) : 'Miễn phí'}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <span className="font-bold">Tổng cộng</span>
                <span className="text-2xl font-extrabold text-primary">{formatCurrency(cart.total)}</span>
              </div>
              {cart.coupon ? (
                <div className="flex items-center justify-between rounded-btn bg-emerald-50 px-3 py-2 text-emerald-700">
                  <span>
                    Đã áp dụng mã <b>{cart.coupon.code}</b>
                  </span>
                  <button type="button" className="text-xs underline" onClick={() => unapply.mutate()}>
                    Bỏ mã
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!code.trim()) return setCodeErr('Vui lòng nhập mã giảm giá.');
                    apply.mutate();
                  }}
                >
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setCodeErr('');
                      }}
                      placeholder="Nhập mã giảm giá"
                      aria-label="Mã giảm giá"
                      className="field uppercase placeholder:normal-case"
                    />
                    <Button type="submit" variant="outline" loading={apply.isPending}>
                      Áp dụng
                    </Button>
                  </div>
                  {codeErr && (
                    <p role="alert" className="mt-1 text-xs text-danger">
                      {codeErr}
                    </p>
                  )}
                </form>
              )}
              <LinkButton href="/checkout" size="lg" block>
                Thanh toán <Icon name="arrowRight" size={16} />
              </LinkButton>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
