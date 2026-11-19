'use client';

// Đặt hàng thành công (WIREFRAME 7.2)
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useRequireCustomer } from '@/hooks/useAuth';
import { addDays, format } from '@/lib/date';
import { formatCurrency, formatDate } from '@/lib/format';
import { paymentMethodShort, paymentStatusInfo } from '@/lib/status';
import { cartApi, orderApi } from '@/services/cart.api';

void cartApi;

function Content() {
  const { ready } = useRequireCustomer();
  const code = useSearchParams().get('order') ?? '';
  const q = useQuery({
    queryKey: ['order', code],
    queryFn: () => orderApi.detail(code),
    enabled: ready && Boolean(code),
  });

  if (!ready || q.isLoading)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (!code || q.isError)
    return (
      <div className="container-page py-8">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <EmptyState
            title="Không tìm thấy đơn hàng"
            action={<LinkButton href="/account/orders">Xem đơn hàng của tôi</LinkButton>}
          />
        )}
      </div>
    );
  const o = q.data!;
  return (
    <div className="container-page py-6">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Giỏ hàng', href: '/cart' },
          { label: 'Thanh toán', href: '/checkout' },
          { label: 'Hoàn tất' },
        ]}
      />
      <div className="card mx-auto max-w-3xl p-6 text-center sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Icon name="check" size={42} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Đặt hàng thành công!</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Cảm ơn bạn đã mua sắm tại Aurelia Living. Chúng tôi đã gửi email xác nhận đơn hàng tới địa chỉ email
          của bạn.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-card bg-surface-muted p-4 text-left text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Mã đơn hàng</dt>
            <dd className="font-bold">#{o.orderCode}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Ngày đặt</dt>
            <dd className="font-bold">{formatDate(o.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Thanh toán</dt>
            <dd className="font-bold">
              {paymentMethodShort[o.paymentMethod]} · {paymentStatusInfo[o.paymentStatus].label}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Dự kiến giao</dt>
            <dd className="font-bold">
              {format(addDays(new Date(o.createdAt), 2))} – {format(addDays(new Date(o.createdAt), 5))}
            </dd>
          </div>
        </dl>
        <ul className="mt-5 divide-y divide-line text-left">
          {o.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-semibold">{it.productName}</p>
                <p className="text-xs text-muted">
                  {it.variantLabel} · x{it.quantity}
                </p>
              </div>
              <span className="font-bold">{formatCurrency(it.lineTotal ?? 0)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-bold">Tổng cộng</span>
          <span className="text-2xl font-extrabold text-primary">{formatCurrency(o.total)}</span>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href={`/account/orders/${o.orderCode}`} size="lg">
            Xem chi tiết đơn hàng
          </LinkButton>
          <LinkButton href="/products" size="lg" variant="outline">
            Tiếp tục mua sắm <Icon name="arrowRight" size={16} />
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
