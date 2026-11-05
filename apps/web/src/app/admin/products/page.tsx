'use client';

// Quản lý sản phẩm – danh sách (WIREFRAME 3.2a)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import { LinkButton } from '@/components/ui/Button';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useCategories } from '@/hooks/useProducts';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatCurrency } from '@/lib/format';
import { productStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { ProductListItem } from '@/types/api';

export default function AdminProductsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: 'createdAt:desc', category: '', status: '' });
  const q = useDebounced(st.q);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [del, setDel] = useState<ProductListItem[] | null>(null);
  const cats = useCategories();
  const list = useQuery({
    queryKey: ['admin', 'products', q, st.page, st.sort, st.category, st.status],
    queryFn: () =>
      adminApi.products.list({
        q,
        page: st.page,
        pageSize: 10,
        sort: st.sort,
        category: st.category,
        status: st.status,
      }),
  });
  const remove = useMutation({
    mutationFn: async (items: ProductListItem[]) => {
      for (const p of items) await adminApi.products.remove(p.id);
    },
    onSuccess: () => {
      toast.success('Đã xóa sản phẩm.');
      setDel(null);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: Column<ProductListItem>[] = [
    {
      key: 'img',
      header: 'Ảnh',
      render: (p) => (
        <span className="block h-12 w-12 overflow-hidden rounded-md bg-surface-muted">
          {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên sản phẩm',
      sortKey: 'name',
      render: (p) => (
        <div>
          <Link href={`/admin/products/${p.id}`} className="font-semibold hover:text-primary">
            {p.name}
          </Link>
          <p className="text-xs text-muted">SKU: {p.sku}</p>
        </div>
      ),
    },
    { key: 'cat', header: 'Danh mục', render: (p) => p.category?.name ?? '—' },
    {
      key: 'price',
      header: 'Giá',
      sortKey: 'price',
      render: (p) => (
        <div>
          <b>{formatCurrency(p.salePrice ?? p.price)}</b>
          {p.salePrice && <p className="text-xs text-muted line-through">{formatCurrency(p.price)}</p>}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Tồn kho',
      sortKey: 'stockQuantity',
      render: (p) => (
        <span className={p.stockQuantity <= 0 ? 'font-semibold text-danger' : ''}>{p.stockQuantity}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (p) => <StatusBadge info={productStatusInfo(p.stockQuantity, p.status)} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        description="Quản lý danh sách sản phẩm, biến thể, hình ảnh và mô hình 3D."
      />
      <FilterBar
        search={{ value: st.q, onChange: (v) => patch({ q: v }), placeholder: 'Tìm theo tên hoặc SKU…' }}
        selects={[
          {
            key: 'category',
            placeholder: 'Tất cả danh mục',
            value: st.category,
            onChange: (v) => patch({ category: v }),
            options: (cats.data ?? []).flatMap((c) => [
              { value: String(c.id), label: c.name },
              ...c.children.map((x) => ({ value: String(x.id), label: `— ${x.name}` })),
            ]),
          },
          {
            key: 'status',
            placeholder: 'Tất cả trạng thái',
            value: st.status,
            onChange: (v) => patch({ status: v }),
            options: [
              { value: 'selling', label: 'Đang bán' },
              { value: 'out', label: 'Tạm hết hàng' },
              { value: 'draft', label: 'Bản nháp' },
              { value: 'archived', label: 'Ẩn' },
            ],
          },
        ]}
        actions={
          <>
            {selected.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDel(list.data?.items.filter((p) => selected.includes(p.id)) ?? [])}
              >
                <Icon name="trash" size={15} /> Xóa ({selected.length})
              </Button>
            )}
            <LinkButton href="/admin/products/new">
              <Icon name="plus" size={16} /> Thêm sản phẩm
            </LinkButton>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(p) => p.id}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        selectable
        selected={selected}
        onSelect={setSelected}
        sort={st.sort}
        onSort={(s) => patch({ sort: s })}
        page={list.data?.meta.page ?? st.page}
        pageSize={10}
        total={list.data?.meta.total}
        onPage={(p) => patch({ page: p })}
        unit="sản phẩm"
        actions={[
          { label: 'Sửa', onClick: (p) => router.push(`/admin/products/${p.id}`) },
          { label: 'Xem trên website', onClick: (p) => window.open(`/products/${p.slug}`, '_blank') },
          { label: 'Xóa', danger: true, onClick: (p) => setDel([p]) },
        ]}
      />
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa sản phẩm"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del)}>
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Bạn chắc chắn muốn xóa{' '}
          {del && del.length > 1 ? `${del.length} sản phẩm đã chọn` : <b>{del?.[0]?.name}</b>}? Sản phẩm sẽ bị
          ẩn khỏi cửa hàng (xóa mềm), đơn hàng cũ không bị ảnh hưởng.
        </p>
      </Modal>
    </div>
  );
}
