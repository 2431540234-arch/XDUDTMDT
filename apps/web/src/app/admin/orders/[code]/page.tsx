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
};
/** Bước kế tiếp của vận đơn (DAC_TA §10.4, UC-ADM-25); đánh dấu "Đã giao" sẽ tự hoàn tất đơn; "Giao thất bại" có thể giao lại */
const SHIP_ACTIONS: Record<string, Array<{ to: string; label: string; danger?: boolean }>> = {
  pending: [{ to: 'picked_up', label: 'Đã lấy hàng' }],
  picked_up: [{ to: 'in_transit', label: 'Đang vận chuyển' }],
  in_transit: [
    { to: 'delivered', label: 'Đánh dấu đã giao' },
    { to: 'failed', label: 'Giao thất bại', danger: true },
    { to: 'returned', label: 'Hoàn hàng', danger: true },
  ],
  failed: [
    { to: 'in_transit', label: 'Giao lại' },
    { to: 'returned', label: 'Hoàn hàng', danger: true },
  ],
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
  const [fee, setFee] = useState('');
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(false);

  useEffect(() => {
    if (!o) return;
    setNote(o.internalNote ?? '');
    setCarrier('ghn');
    setTracking('');
    setFee('');
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
  const afterShip = (r: { order: unknown; warnings: string[] }, msg: string) => {
    refresh(r.order);
    toast.success(msg);
    r.warnings.forEach((w) => toast.info(w));
  };
  const createShip = useMutation({
    mutationFn: () =>
      adminApi.orders.createShipment(o!.id, {
        carrier,
        trackingCode: tracking.trim() || undefined,
        fee: fee.trim() ? Number(fee) : undefined,
      }),
    onSuccess: (r) => {
      afterShip(r, 'Đã tạo vận đơn.');
      setTracking('');
      setFee('');
    },
    onError,
  });
  const moveShip = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminApi.orders.updateShipment(id, { status }),
    onSuccess: (r) =>
      afterShip(
        r,
        r.shipment.status === 'delivered'
          ? 'Đã đánh dấu đã giao, đơn hàng đã hoàn tất.'
          : 'Đã cập nhật vận đơn.',
      ),
    onError,
  });
  const [txnCode, setTxnCode] = useState('');
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState('');
  const confirmPay = useMutation({
    mutationFn: () =>
      adminApi.orders.confirmPayment(
        o!.payment!.id,
        txnCode.trim() ? { transactionCode: txnCode.trim() } : {},
      ),
    onSuccess: (d) => {
      refresh(d);
      setTxnCode('');
      toast.success('Đã xác nhận thanh toán.');
    },
    onError,
  });
  const failPay = useMutation({
    mutationFn: () =>
      adminApi.orders.failPayment(o!.payment!.id, failReason.trim() ? { reason: failReason.trim() } : {}),
    onSuccess: (d) => {
      refresh(d);
      setFailOpen(false);
      setFailReason('');
      toast.success('Đã đánh dấu giao dịch thất bại.');
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
  // vận đơn đang hoạt động = chưa hoàn về (failed còn giao lại được); chỉ khi vận đơn đã returned mới tạo vận đơn mới
  const hasActiveShip = o.shipments.some((x) => x.status !== 'returned');
  // đơn đang giao mà mọi vận đơn đã hoàn về ⇒ admin được hủy đơn (D-N34), sau đó hoàn tiền nếu đã thanh toán
  const allReturned = o.shipments.length > 0 && o.shipments.every((x) => x.status === 'returned');
  const canCreateShip = ['processing', 'shipping'].includes(o.status) && !hasActiveShip;
  const times: Partial<Record<OrderStatus, string>> = {};
  o.history.forEach((h) => (times[h.toStatus] = h.createdAt));
  const canCancel =
    ['pending', 'confirmed', 'processing'].includes(o.status) || (o.status === 'shipping' && allReturned);
  const canRefund = o.status === 'completed' || (o.status === 'cancelled' && o.paymentStatus === 'paid');
  // Chỉ giao dịch CHUYỂN KHOẢN đang chờ đối soát xác nhận/đánh dấu thất bại thủ công (online do cổng quản lý, COD tự ghi nhận).
  // Đơn đã hủy: giao dịch chờ đã bị chuyển "thất bại" lúc hủy; tiền về muộn vẫn xác nhận được để hoàn tiền (D-N33).
  const manualBank =
    o.payment?.method === 'bank_transfer' && o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded';
  const canConfirmPay =
    manualBank &&
    (o.payment!.status === 'pending' || (o.status === 'cancelled' && o.payment!.status === 'failed'));
  const canFailPay = manualBank && o.payment!.status === 'pending';

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
              <Button
                size="sm"
                loading={move.isPending}
                disabled={next.to === 'shipping' && !hasActiveShip}
                title={next.to === 'shipping' && !hasActiveShip ? 'Cần tạo vận đơn trước' : undefined}
                onClick={() => move.mutate(next.to)}
              >
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
            <div className="border-t border-line pt-3" data-testid="shipments">
              <h3 className="mb-2 font-semibold">Vận đơn</h3>
              {o.shipments.length === 0 && <p className="text-xs text-muted">Chưa có vận đơn.</p>}
              <ul className="space-y-3">
                {o.shipments.map((sh) => {
                  const actions = SHIP_ACTIONS[sh.status] ?? [];
                  return (
                    <li key={sh.id} className="rounded-btn border border-line p-3" data-testid="shipment-row">
                      <p className="flex flex-wrap items-center gap-2">
                        <b>{CARRIERS.find((c) => c.value === sh.carrier)?.label ?? sh.carrier}</b>
                        <StatusBadge info={shipmentStatusInfo[sh.status]} />
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Mã vận đơn: {sh.trackingCode ?? '—'} · Phí: {formatCurrency(Number(sh.fee))}
                        {sh.shippedAt && <> · Lấy hàng: {formatDateTime(sh.shippedAt)}</>}
                        {sh.deliveredAt && <> · Đã giao: {formatDateTime(sh.deliveredAt)}</>}
                      </p>
                      {actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {actions.map((a) => (
                            <Button
                              key={a.to}
                              size="sm"
                              variant={a.danger ? 'ghost' : a.to === 'delivered' ? 'primary' : 'outline'}
                              loading={
                                moveShip.isPending &&
                                moveShip.variables?.id === sh.id &&
                                moveShip.variables?.status === a.to
                              }
                              disabled={
                                moveShip.isPending || (a.to === 'delivered' && o.status !== 'shipping')
                              }
                              title={
                                a.to === 'delivered' && o.status !== 'shipping'
                                  ? 'Chuyển đơn sang "Đang giao" trước khi đánh dấu đã giao'
                                  : undefined
                              }
                              onClick={() => moveShip.mutate({ id: sh.id, status: a.to })}
                            >
                              {a.label}
                            </Button>
                          ))}
                        </div>
                      )}
                      {sh.status === 'delivered' && (
                        <p className="mt-2 text-xs text-green-700">
                          Đơn hàng đã tự hoàn tất khi vận đơn được giao.
                        </p>
                      )}
                      {sh.status === 'failed' && (
                        <p className="mt-2 text-xs text-muted">
                          Giao không thành công: chọn “Giao lại” hoặc “Hoàn hàng”. Khách đã được thông báo.
                        </p>
                      )}
                      {sh.status === 'returned' && (
                        <p className="mt-2 text-xs text-muted">
                          Hàng đã hoàn về. Có thể tạo vận đơn mới để giao lại
                          {o.status === 'shipping'
                            ? ', hoặc hủy đơn (rồi hoàn tiền nếu khách đã thanh toán)'
                            : ''}
                          .
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {canCreateShip && (
                <div className="mt-3 space-y-2 rounded-btn bg-surface-muted/50 p-3" aria-label="Tạo vận đơn">
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
                  <div>
                    <label htmlFor="ship-fee" className="mb-1.5 block text-sm font-medium">
                      Phí vận chuyển (để trống = phí của đơn)
                    </label>
                    <input
                      id="ship-fee"
                      inputMode="numeric"
                      className="field"
                      value={fee}
                      onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <Button size="sm" loading={createShip.isPending} onClick={() => createShip.mutate()}>
                    Tạo vận đơn
                  </Button>
                </div>
              )}
              {o.status === 'processing' && !hasActiveShip && (
                <p className="mt-2 text-xs text-muted">
                  Cần tạo vận đơn trước khi chuyển đơn sang “Đang giao”.
                </p>
              )}
            </div>
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
              <div className="mt-2 space-y-2">
                <input
                  value={txnCode}
                  onChange={(e) => setTxnCode(e.target.value)}
                  maxLength={100}
                  placeholder="Mã giao dịch ngân hàng (tùy chọn)"
                  aria-label="Mã giao dịch"
                  className="field text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" loading={confirmPay.isPending} onClick={() => confirmPay.mutate()}>
                    Xác nhận đã thanh toán
                  </Button>
                  {canFailPay && (
                    <Button size="sm" variant="danger" onClick={() => setFailOpen(true)}>
                      Đánh dấu thất bại
                    </Button>
                  )}
                </div>
              </div>
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
        open={failOpen}
        onClose={() => setFailOpen(false)}
        title="Đánh dấu thanh toán thất bại"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFailOpen(false)}>
              Đóng
            </Button>
            <Button variant="danger" loading={failPay.isPending} onClick={() => failPay.mutate()}>
              Đánh dấu thất bại
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Đơn <b>#{o.orderCode}</b>: khách sẽ nhận thông báo chưa xác nhận được thanh toán.
        </p>
        <Textarea
          label="Lý do (tùy chọn)"
          rows={3}
          value={failReason}
          onChange={(e) => setFailReason(e.target.value)}
        />
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
