'use client';

// UC-ADM-24 – Quản lý thanh toán (DAC_TA): danh sách giao dịch từ GET /admin/payments (lọc trạng thái, phương thức, tìm kiếm, phân trang),
// xác nhận đã nhận tiền chuyển khoản (mã giao dịch tùy chọn, duy nhất) hoặc đánh dấu thất bại. Chỉ giao dịch chuyển khoản đang chờ
// đối soát mới có thao tác; online do cổng quản lý và COD chỉ xem.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { paymentMethodShort, type StatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi, type AdminPayment } from '@/services/admin.api';
import { toast } from '@/store/uiStore';

const STATUS: Record<AdminPayment['status'], StatusInfo> = {
  pending: { label: 'Chờ đối soát', tone: 'yellow' },
  success: { label: 'Thành công', tone: 'green' },
  failed: { label: 'Thất bại', tone: 'red' },
  refunded: { label: 'Đã hoàn tiền', tone: 'red' },
};
const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ đối soát' },
  { key: 'success', label: 'Thành công' },
  { key: 'failed', label: 'Thất bại' },
  { key: 'refunded', label: 'Đã hoàn tiền' },
] as const;
const PAGE_SIZE = 10;

/** Chỉ chuyển khoản đang chờ mới xử lý tay được (khớp backend D-N33) */
const canAct = (p: AdminPayment) => p.method === 'bank_transfer' && p.status === 'pending';

export default function AdminPaymentsPage() {
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: '', status: '', method: '' });
  const q = useDebounced(st.q);
  const [confirm, setConfirm] = useState<AdminPayment | null>(null);
  const [fail, setFail] = useState<AdminPayment | null>(null);
  const [txn, setTxn] = useState('');
  const [reason, setReason] = useState('');

  const list = useQuery({
    queryKey: ['admin', 'payments', q, st.page, st.status, st.method],
    queryFn: () =>
      adminApi.payments.list({ q, page: st.page, pageSize: PAGE_SIZE, status: st.status, method: st.method }),
  });
  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
    qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    qc.invalidateQueries({ queryKey: ['admin', 'order'] });
  };
  const doConfirm = useMutation({
    mutationFn: () =>
      adminApi.orders.confirmPayment(confirm!.id, txn.trim() ? { transactionCode: txn.trim() } : {}),
    onSuccess: () => {
      done('Đã xác nhận thanh toán.');
      setConfirm(null);
      setTxn('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const doFail = useMutation({
    mutationFn: () => adminApi.orders.failPayment(fail!.id, reason.trim() ? { reason: reason.trim() } : {}),
    onSuccess: () => {
      done('Đã đánh dấu giao dịch thất bại.');
      setFail(null);
      setReason('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: Column<AdminPayment>[] = [
    {
      key: 'order',
      header: 'Đơn hàng',
      render: (p) => (
        <Link href={`/admin/orders/${p.orderCode}`} className="font-bold text-primary hover:underline">
          #{p.orderCode}
        </Link>
      ),
    },
    {
      key: 'cus',
      header: 'Khách hàng',
      render: (p) => (
        <span className="block">
          {p.customerName}
          {p.customerEmail && <span className="block text-xs text-muted">{p.customerEmail}</span>}
        </span>
      ),
    },
    { key: 'method', header: 'Phương thức', render: (p) => paymentMethodShort[p.method] ?? p.method },
    { key: 'amount', header: 'Số tiền', render: (p) => <b>{formatCurrency(p.amount)}</b> },
    { key: 'status', header: 'Trạng thái', render: (p) => <StatusBadge info={STATUS[p.status]} /> },
    { key: 'txn', header: 'Mã giao dịch', render: (p) => p.transactionCode ?? '—' },
    { key: 'at', header: 'Ngày tạo', render: (p) => formatDateTime(p.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Thanh toán"
        description="Đối soát chuyển khoản ngân hàng: xác nhận đã nhận tiền hoặc đánh dấu thất bại. Giao dịch online do cổng thanh toán quản lý, COD tự ghi nhận khi giao hàng thành công."
      />
      <Tabs
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={st.status as (typeof TABS)[number]['key']}
        onChange={(k) => patch({ status: k })}
      />
      <FilterBar
        search={{
          value: st.q,
          onChange: (v) => patch({ q: v }),
          placeholder: 'Tìm theo mã đơn, mã giao dịch, người nhận…',
        }}
        selects={[
          {
            key: 'method',
            placeholder: 'Tất cả phương thức',
            value: st.method,
            onChange: (v) => patch({ method: v }),
            options: Object.entries(paymentMethodShort).map(([value, label]) => ({ value, label })),
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(p) => p.id}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        page={list.data?.meta.page ?? st.page}
        pageSize={PAGE_SIZE}
        total={list.data?.meta.total}
        onPage={(p) => patch({ page: p })}
        unit="giao dịch"
        emptyTitle="Chưa có giao dịch"
        actions={[
          { label: 'Xác nhận đã nhận tiền', hidden: (p) => !canAct(p), onClick: (p) => setConfirm(p) },
          { label: 'Đánh dấu thất bại', danger: true, hidden: (p) => !canAct(p), onClick: (p) => setFail(p) },
          { label: 'Xem đơn hàng', onClick: (p) => window.location.assign(`/admin/orders/${p.orderCode}`) },
        ]}
      />

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Xác nhận đã nhận tiền"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Đóng
            </Button>
            <Button loading={doConfirm.isPending} onClick={() => doConfirm.mutate()}>
              Xác nhận
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Đơn <b>#{confirm?.orderCode}</b> · {confirm ? formatCurrency(confirm.amount) : ''}. Đối soát sao kê
          rồi nhập mã giao dịch ngân hàng (không bắt buộc, không được trùng giao dịch khác).
        </p>
        <input
          value={txn}
          onChange={(e) => setTxn(e.target.value)}
          maxLength={100}
          aria-label="Mã giao dịch"
          placeholder="Mã giao dịch ngân hàng (tùy chọn)"
          className="field"
        />
      </Modal>
      <Modal
        open={Boolean(fail)}
        onClose={() => setFail(null)}
        title="Đánh dấu thanh toán thất bại"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFail(null)}>
              Đóng
            </Button>
            <Button variant="danger" loading={doFail.isPending} onClick={() => doFail.mutate()}>
              Đánh dấu thất bại
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Đơn <b>#{fail?.orderCode}</b>: khách sẽ nhận thông báo chưa xác nhận được thanh toán.
        </p>
        <Textarea
          label="Lý do (tùy chọn)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
