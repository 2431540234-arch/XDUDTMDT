'use client';

// Kho hàng (WIREFRAME 7.27): KPI tồn kho, bảng tồn kho, phiếu nhập/xuất
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import KpiCard from '@/components/admin/KpiCard';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useCategories } from '@/hooks/useProducts';
import { useDebounced, useListState } from '@/hooks/useListState';
import { downloadCsv } from '@/lib/csv';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { InventoryRow, StockMovement, StockReceipt } from '@/types/api';

const STATE = {
  in_stock: { label: 'Còn hàng', tone: 'green' },
  low: { label: 'Sắp hết', tone: 'yellow' },
  out: { label: 'Hết hàng', tone: 'red' },
} as const;
const MOVEMENT_TYPE = {
  import: { label: 'Nhập kho', tone: 'green' },
  sale: { label: 'Bán hàng', tone: 'blue' },
  return: { label: 'Hàng trả', tone: 'orange' },
  adjustment: { label: 'Điều chỉnh', tone: 'yellow' },
} as const;
const RECEIPT_STATUS = {
  completed: { label: 'Hoàn tất', tone: 'green' },
  draft: { label: 'Nháp', tone: 'yellow' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
} as const;

function ReceiptModal({ type, onClose }: { type: 'in' | 'out' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [supplierName, setSupplierName] = useState('');
  const [lines, setLines] = useState<Array<{ variantId: string; quantity: string; costPrice: string }>>([
    { variantId: '', quantity: '10', costPrice: '' },
  ]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const rows = useQuery({
    queryKey: ['admin', 'inventory', 'pick'],
    queryFn: () => adminApi.inventory.rows({ pageSize: 100, sort: 'productName:asc' }),
    enabled: Boolean(type),
  });
  const create = useMutation({
    mutationFn: (status: 'draft' | 'completed') =>
      adminApi.inventory.createReceipt({
        type: type!,
        status,
        supplierName: type === 'in' ? supplierName.trim() : undefined,
        items: lines
          .filter((l) => l.variantId)
          .map((l) => ({
            variantId: Number(l.variantId),
            quantity: Number(l.quantity),
            costPrice: Number(l.costPrice) || 0,
          })),
      }),
    onSuccess: (r) => {
      toast.success(r.status === 'draft' ? `Đã lưu nháp phiếu ${r.code}.` : `Đã tạo phiếu ${r.code}.`);
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['admin', 'finance'] });
      setLines([{ variantId: '', quantity: '10', costPrice: '' }]);
      setSupplierName('');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = (status: 'draft' | 'completed') => {
    const x: Record<string, string> = {};
    if (type === 'in' && !supplierName.trim()) x.supplierName = 'Vui lòng nhập nhà cung cấp.';
    if (!lines.some((l) => l.variantId)) x.items = 'Vui lòng chọn ít nhất một sản phẩm.';
    if (lines.some((l) => l.variantId && !(Number(l.quantity) >= 1))) x.items = 'Số lượng phải từ 1 trở lên.';
    setErrs(x);
    if (!Object.keys(x).length) create.mutate(status);
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
          <Button variant="outline" disabled={create.isPending} onClick={() => submit('draft')}>
            Lưu nháp
          </Button>
          <Button loading={create.isPending} onClick={() => submit('completed')}>
            Hoàn tất phiếu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {type === 'in' && (
          <Input
            label="Nhà cung cấp"
            required
            placeholder="Nhập tên nhà cung cấp"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            error={errs.supplierName}
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
            ? 'Phiếu nhập hoàn tất sẽ tăng tồn kho và tạo phiếu chi giá vốn. Phiếu nháp chưa đổi tồn kho, xác nhận sau trong danh sách phiếu.'
            : 'Phiếu xuất hoàn tất sẽ giảm tồn kho. Phiếu nháp chưa đổi tồn kho, xác nhận sau trong danh sách phiếu.'}
        </p>
      </div>
    </Modal>
  );
}

/** Điều chỉnh tồn kho trực tiếp cho MỘT biến thể (kiểm kê, hao hụt…): số lượng thay đổi (+/−) và lý do bắt buộc */
function AdjustModal({ row, onClose }: { row: InventoryRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    setQty('');
    setReason('');
    setErrs({});
  }, [row?.variantId]);
  const n = Number(qty);
  const valid = qty.trim() !== '' && Number.isInteger(n) && n !== 0;
  const after = row && valid ? row.stockQuantity + n : null;
  const save = useMutation({
    mutationFn: () =>
      adminApi.inventory.adjust({ variantId: row!.variantId, quantityChange: n, reason: reason.trim() }),
    onSuccess: (r) => {
      toast.success(`Đã điều chỉnh tồn kho: ${r.stockQuantity} sản phẩm.`);
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      onClose();
    },
    onError: (e) => {
      const fe = e instanceof ApiClientError ? e.fieldErrors() : {};
      if (Object.keys(fe).length) setErrs(fe);
      else setErrs({ quantityChange: errorMessage(e) }); // ví dụ 409: giảm quá số đang tồn
    },
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!valid) e.quantityChange = 'Nhập số nguyên khác 0 (âm để giảm tồn).';
    else if (after !== null && after < 0)
      e.quantityChange = `Không thể giảm quá số đang tồn (${row!.stockQuantity}).`;
    if (!reason.trim()) e.reason = 'Vui lòng nhập lý do điều chỉnh.';
    else if (reason.trim().length > 255) e.reason = 'Lý do tối đa 255 ký tự.';
    setErrs(e);
    if (!Object.keys(e).length) save.mutate();
  };
  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title="Điều chỉnh tồn kho"
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Lưu điều chỉnh
          </Button>
        </>
      }
    >
      {row && (
        <div className="space-y-4">
          <p className="text-sm">
            <b>{row.productName}</b> · <code className="text-xs">{row.sku}</code>
            <br />
            Tồn hiện tại: <b>{row.stockQuantity}</b>
          </p>
          <Input
            label="Số lượng thay đổi (+ tăng, − giảm)"
            inputMode="numeric"
            placeholder="Ví dụ: 5 hoặc -3"
            value={qty}
            error={errs.quantityChange}
            hint={after !== null ? `Tồn sau điều chỉnh: ${after}` : undefined}
            onChange={(e) => {
              setQty(e.target.value);
              setErrs((x) => ({ ...x, quantityChange: '' })); // sửa lại thì bỏ lỗi cũ (để hiện gợi ý tồn sau điều chỉnh)
            }}
          />
          <Input
            label="Lý do"
            placeholder="Kiểm kê, hao hụt, hàng hỏng…"
            value={reason}
            error={errs.reason}
            onChange={(e) => {
              setReason(e.target.value);
              setErrs((x) => ({ ...x, reason: '' }));
            }}
          />
        </div>
      )}
    </Modal>
  );
}

export default function AdminInventoryPage() {
  const [st, patch] = useListState({ q: '', page: 1, sort: 'available:asc', category: '', state: '' });
  const q = useDebounced(st.q);
  const [receipt, setReceipt] = useState<'in' | 'out' | null>(null);
  const [adjust, setAdjust] = useState<InventoryRow | null>(null);
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
  const qc = useQueryClient();
  const [movPage, setMovPage] = useState(1);
  const movements = useQuery({
    queryKey: ['admin', 'inventory', 'movements', movPage],
    queryFn: () => adminApi.inventory.movements({ page: movPage, pageSize: 10 }),
  });
  const act = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: 'confirm' | 'cancel' }) =>
      kind === 'confirm' ? adminApi.inventory.confirmReceipt(id) : adminApi.inventory.cancelReceipt(id),
    onSuccess: (r) => {
      toast.success(r.status === 'completed' ? `Đã xác nhận phiếu ${r.code}.` : `Đã hủy phiếu ${r.code}.`);
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['admin', 'finance'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

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
    { key: 'avail', header: 'Có thể bán', sortKey: 'available', render: (r) => <b>{r.available}</b> },
    { key: 'min', header: 'Mức tối thiểu', render: (r) => r.minStock },
    { key: 'state', header: 'Trạng thái', render: (r) => <StatusBadge info={STATE[r.state]} /> },
  ];
  const exportCsv = () =>
    downloadCsv('ton-kho.csv', [
      ['Sản phẩm', 'SKU', 'Giá vốn', 'Tồn kho', 'Có thể bán', 'Mức tối thiểu'],
      ...(list.data?.items ?? []).map((r) => [
        r.productName,
        r.sku,
        r.costPrice,
        r.stockQuantity,
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
        actions={[{ label: 'Điều chỉnh tồn', onClick: setAdjust }]}
      />
      <AdjustModal row={adjust} onClose={() => setAdjust(null)} />
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
                <th className="text-right">Thao tác</th>
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
                  <td className="text-right">
                    {r.status === 'draft' && (
                      <span className="inline-flex gap-2">
                        <Button
                          size="sm"
                          disabled={act.isPending}
                          aria-label={`Xác nhận phiếu ${r.code}`}
                          onClick={() => act.mutate({ id: r.id, kind: 'confirm' })}
                        >
                          Xác nhận
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={act.isPending}
                          aria-label={`Hủy phiếu ${r.code}`}
                          onClick={() => act.mutate({ id: r.id, kind: 'cancel' })}
                        >
                          Hủy
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-bold">Lịch sử biến động tồn kho</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Thời gian</th>
                <th>Sản phẩm</th>
                <th>Loại</th>
                <th className="text-right">Thay đổi</th>
                <th>Chứng từ</th>
                <th>Lý do</th>
                <th>Người thực hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(movements.data?.items as StockMovement[] | undefined)?.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5">{formatDate(m.createdAt)}</td>
                  <td>
                    {m.productName} <code className="text-xs text-muted">{m.sku}</code>
                  </td>
                  <td>
                    <StatusBadge info={MOVEMENT_TYPE[m.type]} />
                  </td>
                  <td
                    className={`text-right font-semibold ${m.quantityChange < 0 ? 'text-danger' : 'text-emerald-600'}`}
                  >
                    {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                  </td>
                  <td>{m.referenceCode ?? '—'}</td>
                  <td>{m.reason ?? '—'}</td>
                  <td>{m.performedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {movements.data && movements.data.meta.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <Button
              size="sm"
              variant="outline"
              disabled={movPage <= 1}
              aria-label="Trang trước (lịch sử biến động)"
              onClick={() => setMovPage((p) => p - 1)}
            >
              Trước
            </Button>
            <span>
              {movPage}/{movements.data.meta.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={movPage >= movements.data.meta.totalPages}
              aria-label="Trang sau (lịch sử biến động)"
              onClick={() => setMovPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        )}
      </section>
      <ReceiptModal type={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
