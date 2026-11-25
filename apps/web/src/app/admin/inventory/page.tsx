'use client';

// Kho hàng (WIREFRAME 7.27): KPI tồn kho, bảng tồn kho theo biến thể
import { useQuery } from '@tanstack/react-query';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import KpiCard from '@/components/admin/KpiCard';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import StatusBadge from '@/components/ui/StatusBadge';
import { useCategories } from '@/hooks/useProducts';
import { useDebounced, useListState } from '@/hooks/useListState';
import { downloadCsv } from '@/lib/csv';
import { formatCurrency, formatNumber } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import type { InventoryRow } from '@/types/api';

const STATE = {
  in_stock: { label: 'Còn hàng', tone: 'green' },
  low: { label: 'Sắp hết', tone: 'yellow' },
  out: { label: 'Hết hàng', tone: 'red' },
} as const;

export default function AdminInventoryPage() {
  const [st, patch] = useListState({ q: '', page: 1, sort: 'available:asc', category: '', state: '' });
  const q = useDebounced(st.q);
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
        description="Theo dõi tồn kho và giá vốn."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Icon name="download" size={16} /> Xuất Excel
          </Button>
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
    </div>
  );
}
