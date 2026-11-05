'use client';

// Chi tiết đơn hàng (admin) – WIREFRAME 7.18
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import OrderStepper from '@/components/account/OrderStepper';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { formatCurrency, formatDate, formatDateTime, initials } from '@/lib/format';
import { orderStatusInfo, paymentMethodLabel, paymentStatusInfo, shipmentStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { OrderStatus } from '@aurelia-living/shared-types';

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: 'confirmed', label: 'Xác nhận đơn hàng' },
  confirmed: { to: 'processing', label: 'Chuyển sang “Đang xử lý”' },
  processing: { to: 'shipping', label: 'Chuyển sang “Đang giao”' },
  shipping: { to: 'completed', label: 'Xác nhận đã giao' },
};
const CARRIERS = [
  { value: 'ghn', label: 'Giao Hàng Nhanh (GHN)' },
  { value: 'ghtk', label: 'Giao Hàng Tiết Kiệm (GHTK)' },
  { value: 'viettel_post', label: 'Viettel Post' },
  { value: 'other', label: 'Khác' },
];

export default function AdminOrderDetailPage() {
  const { code } = useParams<{ code: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'order', code], queryFn: () => adminApi.orders.get(code) });
  const o = q.data;
  const [note, setNote] = useState('');
  const [carrier, setCarrier] = useState('ghn');
  const [tracking, setTracking] = useState('');
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(false);

  useEffect(() => {
    if (!o) return;
    setNote(o.internalNote ?? '');
    setCarrier(o.shipment?.carrier ?? 'ghn');
    setTracking(o.shipment?.trackingCode ?? '');
  }, [o?.id, o?.updatedAt]);

  const refresh = (data: unknown) => {
    qc.setQueryData(['admin', 'order', code], data);
    qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const move = useMutation({
    mutationFn: (to: OrderStatus) => adminApi.orders.setStatus(o!.id, to),
    onSuccess: (d) => {
      refresh(d);
      toast.success('Đã cập nhật trạng thái đơn hàng.');
    },
    onError,
  });
  const doCancel = useMutation({
    mutationFn: () => adminApi.orders.cancel(o!.id, reason.trim() || 'Doanh nghiệp hủy đơn hàng'),
    onSuccess: (d) => {
      refresh(d);
      setCancel(false);
      toast.success('Đã hủy đơn hàng.');
    },
    onError,
  });
  const doRefund = useMutation({
    mutationFn: () => adminApi.orders.refund(o!.id),
    onSuccess: (d) => {
      refresh(d);
      setRefund(false);
      toast.success('Đã hoàn tiền và tạo phiếu chi.');
    },
    onError,
  });
  const saveShip = useMutation({
    mutationFn: () => adminApi.orders.updateShipment(o!.id, { carrier, trackingCode: tracking }),
    onSuccess: (d) => {
      refresh(d);
      toast.success('Đã cập nhật vận chuyển.');
    },
    onError,
  });
  const confirmPay = useMutation({
    mutationFn: () => adminApi.orders.confirmPayment(o!.payment!.id),
    onSuccess: (d) => {
      refresh(d);
      toast.success('Đã xác nhận thanh toán.');
    },
    onError,
  });
  const saveNote = useMutation({
    mutationFn: () => adminApi.orders.saveNote(o!.id, note),
    onSuccess: (d) => {
      refresh(d);
      toast.success('Đã lưu ghi chú nội bộ.');
    },
    onError,
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError)
    return q.error instanceof ApiClientError && q.error.status === 404 ? (
      <EmptyState icon="receipt" title="Không tìm thấy đơn hàng" />
    ) : (
      <ErrorState onRetry={() => q.refetch()} />
    );
  if (!o) return null;
  const next = NEXT[o.status];
  const times: Partial<Record<OrderStatus, string>> = {};
  o.history.forEach((h) => (times[h.toStatus] = h.createdAt));
  const canCancel = ['pending', 'confirmed', 'processing'].includes(o.status);
  const canRefund = o.status === 'completed' || (o.status === 'cancelled' && o.paymentStatus === 'paid');
  const canConfirmPay =
    o.payment && o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded' && o.status !== 'cancelled';

  return (
    <div className="space-y-5">
      <div>
        <nav className="mb-2 flex items-center gap-1.5 text-sm text-muted">
          <Link href="/admin/orders" className="hover:text-primary">
            ‹ Đơn hàng
          </Link>
          <span>›</span>
          <span className="font-semibold text-primary">#{o.orderCode}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold">Đơn hàng #{o.orderCode}</h1>
            <StatusBadge info={orderStatusInfo[o.status]} className="!px-3 !py-1 !text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Icon name="print" size={15} /> In hóa đơn
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Icon name="truck" size={15} /> In phiếu giao
            </Button>
            {canCancel && (
              <Button variant="danger" size="sm" onClick={() => setCancel(true)}>
                Hủy đơn
              </Button>
            )}
            {canRefund && (
              <Button variant="outline" size="sm" onClick={() => setRefund(true)}>
                Hoàn tiền
              </Button>
            )}
            {next && (
              <Button size="sm" loading={move.isPending} onClick={() => move.mutate(next.to)}>
                {next.label}
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted">
          Đặt lúc {formatDateTime(o.createdAt)} · {o.itemCount} sản phẩm
        </p>
      </div>

      <section className="card p-5">
        <OrderStepper status={o.status} times={times} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card overflow-hidden">
            <h2 className="px-5 pt-5 font-bold">Sản phẩm</h2>
            <div className="overflow-x-auto p-5 pt-3">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="py-2">Sản phẩm</th>
                    <th>SKU</th>
                    <th>Đơn giá</th>
                    <th>SL</th>
                    <th className="text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {o.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-3">
                        <span className="flex items-center gap-3">
                          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                            {it.imageUrl && (
                              <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span>
                            <span className="block font-semibold">{it.productName}</span>
                            <span className="text-xs text-muted">{it.variantLabel}</span>
                          </span>
                        </span>
                      </td>
                      <td className="text-xs text-muted">{it.sku}</td>
                      <td>{formatCurrency(it.unitPrice)}</td>
                      <td>{it.quantity}</td>
                      <td className="text-right font-semibold">{formatCurrency(it.lineTotal ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="ml-auto mt-3 max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Tạm tính</dt>
                  <dd>{formatCurrency(o.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Giảm giá{o.couponCode ? ` (${o.couponCode})` : ''}</dt>
                  <dd className="text-danger">
                    {o.discountAmount ? `-${formatCurrency(o.discountAmount)}` : formatCurrency(0)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Phí vận chuyển</dt>
                  <dd>{formatCurrency(o.shippingFee)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                  <dt>Tổng cộng</dt>
                  <dd className="text-primary">{formatCurrency(o.total)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-bold">Lịch sử xử lý</h2>
            <ol className="relative space-y-4 border-l-2 border-line pl-5">
              {[...o.history].reverse().map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-primary" />
                  <p className="text-sm">
                    <b>{h.actorName}</b> – {h.note ?? orderStatusInfo[h.toStatus].label}
                  </p>
                  <p className="text-xs text-muted">
                    {orderStatusInfo[h.toStatus].label} · {formatDateTime(h.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-5 border-t border-line pt-4">
              <Textarea
                label="Ghi chú nội bộ"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Chỉ nhân sự cửa hàng nhìn thấy…"
              />
              <Button
                size="sm"
                className="mt-2"
                loading={saveNote.isPending}
                onClick={() => saveNote.mutate()}
              >
                Lưu
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-bold">Khách hàng</h2>
            {o.customer && (
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                  {initials(o.customer.fullName)}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/admin/customers/${o.customer.id}`}
                    className="font-semibold hover:text-primary"
                  >
                    {o.customer.fullName}
                  </Link>
                  <p className="truncate text-xs text-muted">{o.customer.email}</p>
                  <p className="text-xs text-muted">
                    {o.customer.phone} · {o.customer.totalOrders} đơn ·{' '}
                    {o.customer.customerGroup === 'loyal' ? 'Khách hàng thân thiết' : 'Khách hàng mới'}
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-bold">Giao hàng</h2>
            <p>
              <b>{o.recipientName}</b> · {o.recipientPhone}
              <br />
              <span className="text-muted">
                {o.shippingAddress}, {o.shippingWard}, {o.shippingDistrict}, {o.shippingProvince}
              </span>
            </p>
            <Select
              label="Đơn vị vận chuyển"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              options={CARRIERS}
            />
            <div>
              <label htmlFor="tracking" className="mb-1.5 block text-sm font-medium">
                Mã vận đơn
              </label>
              <input
                id="tracking"
                className="field"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="VD: GHN123456789"
              />
            </div>
            {o.shipment && (
              <p className="text-xs text-muted">
                Trạng thái vận đơn: <StatusBadge info={shipmentStatusInfo[o.shipment.status]} />
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              loading={saveShip.isPending}
              onClick={() => saveShip.mutate()}
            >
              Cập nhật vận chuyển
            </Button>
          </section>
          <section className="card space-y-2 p-5 text-sm">
            <h2 className="font-bold">Thanh toán</h2>
            <p>{paymentMethodLabel[o.paymentMethod]}</p>
            <StatusBadge info={paymentStatusInfo[o.paymentStatus]} />
            {o.payment?.transactionCode && (
              <p className="text-xs text-muted">Mã giao dịch: {o.payment.transactionCode}</p>
            )}
            {o.payment?.paidAt && (
              <p className="text-xs text-muted">Thanh toán lúc {formatDateTime(o.payment.paidAt)}</p>
            )}
            {canConfirmPay && (
              <Button
                size="sm"
                className="mt-2"
                loading={confirmPay.isPending}
                onClick={() => confirmPay.mutate()}
              >
                Xác nhận đã thanh toán
              </Button>
            )}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-bold">Ghi chú của khách</h2>
            <p className="text-muted">{o.note ?? 'Không có ghi chú.'}</p>
            {o.cancelReason && (
              <p className="mt-2 rounded bg-rose-50 p-2 text-danger">Lý do hủy: {o.cancelReason}</p>
            )}
            <p className="mt-2 text-xs text-muted">Ngày giao: {formatDate(o.deliveredAt)}</p>
          </section>
        </aside>
      </div>

      <Modal
        open={cancel}
        onClose={() => setCancel(false)}
        title="Hủy đơn hàng"
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancel(false)}>
              Đóng
            </Button>
            <Button variant="danger" loading={doCancel.isPending} onClick={() => doCancel.mutate()}>
              Xác nhận hủy
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Hủy đơn <b>#{o.orderCode}</b>: tồn kho và lượt dùng mã giảm giá sẽ được hoàn lại.
        </p>
        <Textarea label="Lý do hủy" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
      <Modal
        open={refund}
        onClose={() => setRefund(false)}
        title="Hoàn tiền thủ công"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefund(false)}>
              Đóng
            </Button>
            <Button loading={doRefund.isPending} onClick={() => doRefund.mutate()}>
              Xác nhận hoàn tiền
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Hoàn <b>{formatCurrency(o.total)}</b> cho khách và tạo phiếu chi “Hoàn tiền”. Cổng thanh toán sẽ
          không được gọi (hoàn thủ công).
        </p>
      </Modal>
    </div>
  );
}
