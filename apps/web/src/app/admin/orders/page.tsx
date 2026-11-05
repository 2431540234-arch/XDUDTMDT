'use client';

// Quản lý đơn hàng – danh sách (WIREFRAME 3.5)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { orderStatusInfo, paymentMethodShort, paymentStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { OrderView } from '@/types/api';

const TABS = [
  { key: 'all', label: 'Tất cả', status: '' },
  { key: 'pending', label: 'Chờ xác nhận', status: 'pending' },
  { key: 'processing', label: 'Đang xử lý', status: 'confirmed,processing' },
  { key: 'shipping', label: 'Đang giao', status: 'shipping' },
  { key: 'completed', label: 'Đã giao', status: 'completed' },
  { key: 'cancelled', label: 'Đã hủy', status: 'cancelled,refunded' },
] as const;

function CreateOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [method, setMethod] = useState('cod');
  const [lines, setLines] = useState<Array<{ variantId: string; quantity: string }>>([
    { variantId: '', quantity: '1' },
  ]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const customers = useQuery({
    queryKey: ['admin', 'customers', 'all'],
    queryFn: () => adminApi.customers.list({ pageSize: 100, status: 'active' }),
    enabled: open,
  });
  const variants = useQuery({
    queryKey: ['admin', 'inventory', 'pick'],
    queryFn: () => adminApi.inventory.rows({ pageSize: 100, sort: 'productName:asc' }),
    enabled: open,
  });
  const create = useMutation({
    mutationFn: () =>
      adminApi.orders.create({
        userId: Number(userId),
        paymentMethod: method,
        items: lines
          .filter((l) => l.variantId)
          .map((l) => ({ variantId: Number(l.variantId), quantity: Number(l.quantity) || 1 })),
      }),
    onSuccess: (o) => {
      toast.success(`Đã tạo đơn ${o.orderCode}.`);
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      onClose();
      router.push(`/admin/orders/${o.orderCode}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (!userId) x.userId = 'Vui lòng chọn khách hàng.';
    if (!lines.some((l) => l.variantId)) x.items = 'Vui lòng chọn ít nhất một sản phẩm.';
    setErrs(x);
    if (!Object.keys(x).length) create.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tạo đơn hàng"
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Tạo đơn hàng
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Khách hàng"
          required
          placeholder="Chọn khách hàng"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          error={errs.userId}
          options={(customers.data?.items ?? []).map((c) => ({
            value: c.id,
            label: `${c.fullName} – ${c.email}`,
          }))}
        />
        <div>
          <p className="mb-2 text-sm font-medium">
            Sản phẩm <span className="text-danger">*</span>
          </p>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-2">
                <select
                  aria-label="Sản phẩm"
                  className="field"
                  value={l.variantId}
                  onChange={(e) =>
                    setLines(lines.map((x, k) => (k === i ? { ...x, variantId: e.target.value } : x)))
                  }
                >
                  <option value="">Chọn sản phẩm</option>
                  {variants.data?.items
                    .filter((v) => v.available > 0)
                    .map((v) => (
                      <option key={v.variantId} value={v.variantId}>
                        {v.productName} ({formatCurrency(Math.round(v.costPrice / 0.62))}) – còn {v.available}
                      </option>
                    ))}
                </select>
                <input
                  aria-label="Số lượng"
                  inputMode="numeric"
                  className="field"
                  value={l.quantity}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, k) =>
                        k === i ? { ...x, quantity: e.target.value.replace(/\D/g, '') } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Xóa dòng"
                  className="p-2 text-muted hover:text-danger"
                  onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : lines)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
          {errs.items && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errs.items}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setLines([...lines, { variantId: '', quantity: '1' }])}
          >
            <Icon name="plus" size={14} /> Thêm sản phẩm
          </Button>
        </div>
        <Select
          label="Phương thức thanh toán"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={Object.entries(paymentMethodShort).map(([value, label]) => ({ value, label }))}
        />
        <p className="text-xs text-muted">Đơn được giao tới địa chỉ mặc định của khách hàng.</p>
      </div>
    </Modal>
  );
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [st, patch] = useListState({
    q: '',
    page: 1,
    sort: 'createdAt:desc',
    tab: 'all',
    payment: '',
    from: '',
    to: '',
  });
  const q = useDebounced(st.q);
  const [create, setCreate] = useState(false);
  const counts = useQuery({ queryKey: ['admin', 'orders', 'counts'], queryFn: adminApi.orders.counts });
  const status = TABS.find((t) => t.key === st.tab)?.status ?? '';
  const list = useQuery({
    queryKey: ['admin', 'orders', q, st.page, st.sort, st.tab, st.payment, st.from, st.to],
    queryFn: () =>
      adminApi.orders.list({
        q,
        page: st.page,
        pageSize: 10,
        sort: st.sort,
        status,
        paymentStatus: st.payment,
        from: st.from,
        to: st.to,
      }),
  });
  const c = counts.data;
  const countOf = (k: string) =>
    !c
      ? undefined
      : k === 'all'
        ? c.all
        : k === 'processing'
          ? c.confirmed + c.processing
          : k === 'cancelled'
            ? c.cancelled + c.refunded
            : c[k];

  const columns: Column<OrderView>[] = [
    {
      key: 'code',
      header: 'Mã đơn',
      sortKey: 'orderCode',
      render: (o) => (
        <Link href={`/admin/orders/${o.orderCode}`} className="font-semibold hover:text-primary">
          #{o.orderCode}
        </Link>
      ),
    },
    {
      key: 'cus',
      header: 'Khách hàng',
      render: (o) => (
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {initials(o.customer?.fullName ?? '?')}
          </span>
          {o.customer?.fullName}
        </span>
      ),
    },
    { key: 'date', header: 'Ngày đặt', sortKey: 'createdAt', render: (o) => formatDate(o.createdAt) },
    { key: 'total', header: 'Tổng tiền', sortKey: 'total', render: (o) => <b>{formatCurrency(o.total)}</b> },
    { key: 'status', header: 'Trạng thái', render: (o) => <StatusBadge info={orderStatusInfo[o.status]} /> },
    {
      key: 'pay',
      header: 'Thanh toán',
      render: (o) => (
        <div className="space-y-1">
          <StatusBadge info={paymentStatusInfo[o.paymentStatus]} />
          <p className="text-xs text-muted">{paymentMethodShort[o.paymentMethod]}</p>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Đơn hàng"
        description="Theo dõi và xử lý đơn hàng của khách."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Icon name="plus" size={16} /> Tạo đơn hàng
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: countOf(t.key) }))}
        value={st.tab as (typeof TABS)[number]['key']}
        onChange={(k) => patch({ tab: k })}
      />
      <FilterBar
        search={{
          value: st.q,
          onChange: (v) => patch({ q: v }),
          placeholder: 'Tìm theo mã đơn, tên, email, SĐT…',
        }}
        selects={[
          {
            key: 'pay',
            placeholder: 'Tất cả thanh toán',
            value: st.payment,
            onChange: (v) => patch({ payment: v }),
            options: Object.entries(paymentStatusInfo).map(([value, i]) => ({ value, label: i.label })),
          },
        ]}
        dateRange={{ from: st.from, to: st.to, onChange: (from, to) => patch({ from, to }) }}
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(o) => o.id}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        selectable
        selected={[]}
        onSelect={() => undefined}
        sort={st.sort}
        onSort={(s) => patch({ sort: s })}
        page={list.data?.meta.page ?? st.page}
        total={list.data?.meta.total}
        onPage={(p) => patch({ page: p })}
        unit="đơn hàng"
        actions={[{ label: 'Xem chi tiết', onClick: (o) => router.push(`/admin/orders/${o.orderCode}`) }]}
      />
      <CreateOrderModal open={create} onClose={() => setCreate(false)} />
    </div>
  );
}
