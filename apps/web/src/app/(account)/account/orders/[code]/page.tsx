'use client';

// Chi tiết đơn hàng của khách (WIREFRAME 7.1)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import OrderStepper from '@/components/account/OrderStepper';
import ReviewModal from '@/components/account/ReviewModal';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { queryKeys } from '@/hooks/useCart';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { orderStatusInfo, paymentMethodLabel, paymentStatusInfo, shipmentStatusInfo } from '@/lib/status';
import { navigateTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { cartApi, orderApi } from '@/services/cart.api';
import { toast } from '@/store/uiStore';
import type { OrderStatus } from '@aurelia-living/shared-types';

export default function OrderDetailPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', code], queryFn: () => orderApi.detail(code) });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(false);

  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(q.data!.id, reason.trim() || undefined),
    onSuccess: () => {
      toast.success('Đã hủy đơn hàng.');
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ['order', code] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rebuy = useMutation({
    mutationFn: async () => {
      let cart = null;
      for (const it of q.data!.items)
        if (it.variantId) cart = await cartApi.addItem({ variantId: it.variantId, quantity: it.quantity });
      return cart;
    },
    onSuccess: (cart) => {
      if (cart) qc.setQueryData(queryKeys.cart, cart);
      toast.success('Đã thêm các sản phẩm vào giỏ hàng.');
      router.push('/cart');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const retry = useMutation({
    mutationFn: () => orderApi.retryPayment(q.data!.id),
    onSuccess: (r) => navigateTo(router, r.redirectUrl),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) {
    const nf = q.error instanceof ApiClientError && q.error.status === 404;
    return nf ? (
      <EmptyState
        icon="receipt"
        title="Không tìm thấy đơn hàng"
        action={<LinkButton href="/account/orders">Về danh sách đơn hàng</LinkButton>}
      />
    ) : (
      <ErrorState onRetry={() => q.refetch()} />
    );
  }
  const o = q.data!;
  const times: Partial<Record<OrderStatus, string>> = {};
  o.history.forEach((h) => (times[h.toStatus] = h.createdAt));
  const canCancel = o.status === 'pending' || o.status === 'confirmed';
  const done = o.status === 'completed';
  const returnOpen = done && o.canReturnUntil && new Date(o.canReturnUntil) > new Date();
  const daysLeft = o.canReturnUntil
    ? Math.max(0, Math.ceil((new Date(o.canReturnUntil).getTime() - Date.now()) / 86_400_000))
    : 0;
  const canPayAgain =
    (o.status === 'pending' || o.status === 'confirmed') &&
    o.paymentStatus !== 'paid' &&
    ['vnpay', 'momo', 'zalopay', 'card'].includes(o.paymentMethod);
  const hasUnreviewed = done && o.items.some((i) => !i.reviewed);

  return (
    <div className="space-y-5">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name="arrowLeft" size={16} /> Đơn hàng của tôi
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Chi tiết đơn hàng #{o.orderCode}</h1>
          <p className="text-sm text-muted">
            Đặt ngày {formatDate(o.createdAt)} · {o.itemCount} sản phẩm
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge info={orderStatusInfo[o.status]} className="!px-3 !py-1 !text-sm" />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Icon name="print" size={15} /> In hóa đơn
          </Button>
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              Hủy đơn hàng
            </Button>
          )}
          {hasUnreviewed && (
            <Button size="sm" onClick={() => setReview(true)}>
              Đánh giá sản phẩm
            </Button>
          )}
          {done &&
            (returnOpen ? (
              <LinkButton href={`/account/returns/new?order=${o.orderCode}`} size="sm" variant="outline">
                Yêu cầu đổi trả
              </LinkButton>
            ) : (
              <span className="text-xs text-muted">Đã quá hạn đổi trả 7 ngày</span>
            ))}
        </div>
      </div>
      {returnOpen && (
        <p className="rounded-btn bg-primary-soft px-3 py-2 text-sm">
          Còn <b>{daysLeft} ngày</b> để gửi yêu cầu đổi trả (chính sách 7 ngày).
        </p>
      )}

      <section className="card p-5">
        <OrderStepper status={o.status} times={times} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Sản phẩm</h2>
            <ul className="divide-y divide-line">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <Link
                    href={`/products/${it.productSlug}`}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted"
                  >
                    {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1 text-sm">
                    <Link
                      href={`/products/${it.productSlug}`}
                      className="line-clamp-1 font-semibold hover:text-primary"
                    >
                      {it.productName}
                    </Link>
                    <p className="text-xs text-muted">
                      Phân loại: {it.variantLabel} · x{it.quantity}
                    </p>
                    {done && it.reviewed && <p className="text-xs text-emerald-600">Đã đánh giá</p>}
                  </div>
                  <span className="font-bold">{formatCurrency(it.lineTotal ?? 0)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" loading={rebuy.isPending} onClick={() => rebuy.mutate()}>
                Mua lại
              </Button>
              <LinkButton href="/contact" variant="ghost" size="sm">
                Liên hệ hỗ trợ
              </LinkButton>
            </div>
          </section>
          <section className="card p-5">
            <h2 className="mb-4 font-bold">Lịch sử vận chuyển</h2>
            {o.shipment && (
              <p className="mb-4 text-sm text-muted">
                Đơn vị vận chuyển:{' '}
                <b className="uppercase text-ink">{o.shipment.carrier.replace('_', ' ')}</b> · Mã vận đơn:{' '}
                <b className="text-ink">{o.shipment.trackingCode}</b> ·{' '}
                <StatusBadge info={shipmentStatusInfo[o.shipment.status]} />
              </p>
            )}
            <ol className="relative space-y-4 border-l-2 border-line pl-5">
              {[...o.history].reverse().map((h, i) => (
                <li key={h.id} className="relative">
                  <span
                    className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ${i === 0 ? 'bg-primary' : 'bg-line'}`}
                  />
                  <p className="text-sm font-semibold">{orderStatusInfo[h.toStatus].label}</p>
                  <p className="text-sm text-muted">{h.note}</p>
                  <p className="text-xs text-muted">{formatDateTime(h.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-bold">Thông tin nhận hàng</h2>
            <p className="font-semibold">{o.recipientName}</p>
            <p className="text-muted">{o.recipientPhone}</p>
            <p className="text-muted">
              {o.shippingAddress}, {o.shippingWard}, {o.shippingDistrict}, {o.shippingProvince}
            </p>
            {o.note && <p className="mt-2 rounded bg-surface-muted/60 p-2 text-xs">Ghi chú: {o.note}</p>}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-bold">Thanh toán</h2>
            <p>{paymentMethodLabel[o.paymentMethod]}</p>
            <div className="mt-2">
              <StatusBadge info={paymentStatusInfo[o.paymentStatus]} />
            </div>
            {canPayAgain && (
              <Button size="sm" className="mt-3" loading={retry.isPending} onClick={() => retry.mutate()}>
                Thanh toán ngay
              </Button>
            )}
          </section>
          <section className="card space-y-2 p-5 text-sm">
            <h2 className="mb-1 font-bold">Tổng tiền</h2>
            <div className="flex justify-between">
              <span className="text-muted">Tạm tính</span>
              <span>{formatCurrency(o.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Giảm giá{o.couponCode ? ` (${o.couponCode})` : ''}</span>
              <span className="text-danger">
                {o.discountAmount ? `-${formatCurrency(o.discountAmount)}` : formatCurrency(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Phí vận chuyển</span>
              <span>{o.shippingFee ? formatCurrency(o.shippingFee) : 'Miễn phí'}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <span className="font-bold">Tổng cộng</span>
              <span className="text-xl font-extrabold text-primary">{formatCurrency(o.total)}</span>
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Hủy đơn hàng"
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Không hủy
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Xác nhận hủy
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Bạn chắc chắn muốn hủy đơn <b>#{o.orderCode}</b>? Tồn kho và mã giảm giá (nếu có) sẽ được hoàn lại.
        </p>
        <Textarea
          label="Lý do hủy (không bắt buộc)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
      <ReviewModal open={review} order={o} onClose={() => setReview(false)} />
    </div>
  );
}
