'use client';

// Kho hàng (WIREFRAME 7.27): KPI tồn kho, bảng tồn kho, phiếu nhập/xuất
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import KpiCard from '@/components/admin/KpiCard';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useCategories } from '@/hooks/useProducts';
import { useDebounced, useListState } from '@/hooks/useListState';
import { downloadCsv } from '@/lib/csv';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { InventoryRow, StockReceipt } from '@/types/api';

const STATE = {
  in_stock: { label: 'Còn hàng', tone: 'green' },
  low: { label: 'Sắp hết', tone: 'yellow' },
  out: { label: 'Hết hàng', tone: 'red' },
} as const;
const RECEIPT_STATUS = {
  completed: { label: 'Hoàn tất', tone: 'green' },
  draft: { label: 'Nháp', tone: 'yellow' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
} as const;

function ReceiptModal({ type, onClose }: { type: 'in' | 'out' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Array<{ variantId: string; quantity: string; costPrice: string }>>([
    { variantId: '', quantity: '10', costPrice: '' },
  ]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const suppliers = useQuery({
    queryKey: ['admin', 'suppliers'],
    queryFn: adminApi.inventory.suppliers,
    enabled: type === 'in',
  });
  const rows = useQuery({
    queryKey: ['admin', 'inventory', 'pick'],
    queryFn: () => adminApi.inventory.rows({ pageSize: 100, sort: 'productName:asc' }),
    enabled: Boolean(type),
  });
  const create = useMutation({
    mutationFn: () =>
      adminApi.inventory.createReceipt({
        type: type!,
        supplierId: supplierId ? Number(supplierId) : null,
        items: lines
          .filter((l) => l.variantId)
          .map((l) => ({
            variantId: Number(l.variantId),
            quantity: Number(l.quantity),
            costPrice: Number(l.costPrice) || 0,
          })),
      }),
    onSuccess: (r) => {
      toast.success(`Đã tạo phiếu ${r.code}.`);
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['admin', 'finance'] });
      setLines([{ variantId: '', quantity: '10', costPrice: '' }]);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (type === 'in' && !supplierId) x.supplierId = 'Vui lòng chọn nhà cung cấp.';
    if (!lines.some((l) => l.variantId)) x.items = 'Vui lòng chọn ít nhất một sản phẩm.';
    if (lines.some((l) => l.variantId && !(Number(l.quantity) >= 1))) x.items = 'Số lượng phải từ 1 trở lên.';
    setErrs(x);
    if (!Object.keys(x).length) create.mutate();
  };
  return (
    <Modal
      open={Boolean(type)}
      onClose={onClose}
      title={type === 'in' ? 'Tạo phiếu nhập kho' : 'Tạo phiếu xuất kho'}
      width={720}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Hoàn tất phiếu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {type === 'in' && (
          <Select
            label="Nhà cung cấp"
            required
            placeholder="Chọn nhà cung cấp"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            error={errs.supplierId}
            options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
        <div>
          <p className="mb-2 text-sm font-medium">
            Sản phẩm <span className="text-danger">*</span>
          </p>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_120px_auto] gap-2">
                <select
                  aria-label="Sản phẩm"
                  className="field"
                  value={l.variantId}
                  onChange={(e) => {
                    const r = rows.data?.items.find((x) => String(x.variantId) === e.target.value);
                    setLines(
                      lines.map((x, k) =>
                        k === i
                          ? { ...x, variantId: e.target.value, costPrice: r ? String(r.costPrice) : '' }
                          : x,
                      ),
                    );
                  }}
                >
                  <option value="">Chọn sản phẩm</option>
                  {rows.data?.items.map((r) => (
                    <option key={r.variantId} value={r.variantId}>
                      {r.productName} ({r.sku}) – tồn {r.available}
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
                <input
                  aria-label="Giá vốn"
                  inputMode="numeric"
                  className="field"
                  placeholder="Giá vốn"
                  value={l.costPrice}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, k) =>
                        k === i ? { ...x, costPrice: e.target.value.replace(/\D/g, '') } : x,
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
            onClick={() => setLines([...lines, { variantId: '', quantity: '10', costPrice: '' }])}
          >
            <Icon name="plus" size={14} /> Thêm dòng
          </Button>
        </div>
        <p className="text-xs text-muted">
          {type === 'in'
            ? 'Phiếu nhập hoàn tất sẽ tăng tồn kho và tạo phiếu chi giá vốn.'
            : 'Phiếu xuất hoàn tất sẽ giảm tồn kho.'}
        </p>
      </div>
    </Modal>
  );
}

export default function AdminInventoryPage() {
  const [st, patch] = useListState({ q: '', page: 1, sort: 'available:asc', category: '', state: '' });
  const q = useDebounced(st.q);
  const [receipt, setReceipt] = useState<'in' | 'out' | null>(null);
  const cats = useCategories();
  const summary = useQuery({
    queryKey: ['admin', 'inventory', 'summary'],
    queryFn: adminApi.inventory.summary,
  });
  const list = useQuery({
    queryKey: ['admin', 'inventory', q, st.page, st.sort, st.category, st.state],
    queryFn: () =>
      adminApi.inventory.rows({
        q,
        page: st.page,
        pageSize: 10,
        sort: st.sort,
        categoryId: st.category,
        state: st.state,
      }),
  });
  const receipts = useQuery({
    queryKey: ['admin', 'inventory', 'receipts'],
    queryFn: adminApi.inventory.receipts,
  });
  const s = summary.data;

  const columns: Column<InventoryRow>[] = [
    {
      key: 'p',
      header: 'Sản phẩm',
      sortKey: 'productName',
      render: (r) => (
        <span className="flex items-center gap-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-muted">
            {r.imageUrl && <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />}
          </span>
          <span className="line-clamp-2 max-w-[220px] font-semibold">{r.productName}</span>
        </span>
      ),
    },
    { key: 'sku', header: 'SKU', render: (r) => <code className="text-xs">{r.sku}</code> },
    { key: 'cost', header: 'Giá vốn', sortKey: 'costPrice', render: (r) => formatCurrency(r.costPrice) },
    { key: 'stock', header: 'Tồn kho', sortKey: 'stockQuantity', render: (r) => r.stockQuantity },
    { key: 'held', header: 'Đang giữ', render: (r) => r.reservedQty },
    { key: 'avail', header: 'Có thể bán', sortKey: 'available', render: (r) => <b>{r.available}</b> },
    { key: 'min', header: 'Mức tối thiểu', render: (r) => r.minStock },
    { key: 'state', header: 'Trạng thái', render: (r) => <StatusBadge info={STATE[r.state]} /> },
  ];
  const exportCsv = () =>
    downloadCsv('ton-kho.csv', [
      ['Sản phẩm', 'SKU', 'Giá vốn', 'Tồn kho', 'Đang giữ', 'Có thể bán', 'Mức tối thiểu'],
      ...(list.data?.items ?? []).map((r) => [
        r.productName,
        r.sku,
        r.costPrice,
        r.stockQuantity,
        r.reservedQty,
        r.available,
        r.minStock,
      ]),
    ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kho hàng"
        description="Theo dõi tồn kho, giá vốn và các phiếu nhập/xuất."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Icon name="download" size={16} /> Xuất Excel
            </Button>
            <Button variant="outline" onClick={() => setReceipt('out')}>
              Tạo phiếu xuất
            </Button>
            <Button onClick={() => setReceipt('in')}>Tạo phiếu nhập</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tổng tồn kho"
          icon="boxes"
          loading={summary.isLoading}
          value={formatNumber(s?.totalStock ?? 0)}
        />
        <KpiCard
          label="Giá trị tồn kho (giá vốn)"
          icon="dollar"
          loading={summary.isLoading}
          value={formatCurrency(s?.stockValue ?? 0)}
        />
        <KpiCard
          label="Sắp hết hàng"
          icon="alert"
          loading={summary.isLoading}
          value={String(s?.lowCount ?? 0)}
        />
        <KpiCard label="Hết hàng" icon="box" loading={summary.isLoading} value={String(s?.outCount ?? 0)} />
      </div>
      <FilterBar
        search={{ value: st.q, onChange: (v) => patch({ q: v }), placeholder: 'Tìm theo tên sản phẩm, SKU…' }}
        selects={[
          {
            key: 'c',
            placeholder: 'Tất cả danh mục',
            value: st.category,
            onChange: (v) => patch({ category: v }),
            options: (cats.data ?? []).flatMap((c) => [
              { value: String(c.id), label: c.name },
              ...c.children.map((x) => ({ value: String(x.id), label: `— ${x.name}` })),
            ]),
          },
          {
            key: 's',
            placeholder: 'Tất cả tình trạng',
            value: st.state,
            onChange: (v) => patch({ state: v }),
            options: Object.entries(STATE).map(([value, i]) => ({ value, label: i.label })),
          },
        ]}
        className="!mb-0"
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.variantId}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        sort={st.sort}
        onSort={(x) => patch({ sort: x })}
        page={list.data?.meta.page ?? st.page}
        total={list.data?.meta.total}
        onPage={(p) => patch({ page: p })}
        unit="biến thể"
      />
      <section className="card p-5">
        <h2 className="mb-3 font-bold">Phiếu nhập / xuất gần đây</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Mã phiếu</th>
                <th>Loại</th>
                <th>Nhà cung cấp / Đơn hàng</th>
                <th>Số SP</th>
                <th>Tổng giá trị</th>
                <th>Ngày</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(receipts.data as StockReceipt[] | undefined)?.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 font-semibold">{r.code}</td>
                  <td>
                    <StatusBadge
                      label={r.type === 'in' ? 'Nhập' : 'Xuất'}
                      tone={r.type === 'in' ? 'green' : 'orange'}
                    />
                  </td>
                  <td>{r.supplierName ?? r.orderCode ?? '—'}</td>
                  <td>{r.itemCount}</td>
                  <td>{formatCurrency(r.total)}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>
                    <StatusBadge info={RECEIPT_STATUS[r.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ReceiptModal type={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
