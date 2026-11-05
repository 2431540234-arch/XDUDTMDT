'use client';

// Quản lý khuyến mãi / coupon (WIREFRAME 3.9)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatCurrency, formatDate } from '@/lib/format';
import { couponStatus } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { CouponView } from '@/types/api';

const KIND_LABEL = { percent: 'Giảm theo %', fixed: 'Giảm số tiền', freeship: 'Miễn phí ship' } as const;
const valueOf = (c: CouponView) =>
  c.kind === 'percent' ? `${c.value}%` : c.kind === 'fixed' ? formatCurrency(c.value) : 'Phí ship';

export default function AdminPromotionsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: 'startsAt:desc', tab: 'all', kind: '' });
  const q = useDebounced(st.q);
  const [del, setDel] = useState<CouponView | null>(null);
  const list = useQuery({
    queryKey: ['admin', 'coupons', q, st.page, st.sort, st.tab, st.kind],
    queryFn: () =>
      adminApi.coupons.list({ q, page: st.page, pageSize: 10, sort: st.sort, tab: st.tab, kind: st.kind }),
  });
  const meta = list.data?.meta as unknown as
    { all?: number; active?: number; upcoming?: number; ended?: number } | undefined;
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.coupons.remove(id),
    onSuccess: () => {
      toast.success('Đã xử lý khuyến mãi.');
      setDel(null);
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: Column<CouponView>[] = [
    {
      key: 'code',
      header: 'Mã khuyến mãi',
      sortKey: 'code',
      render: (c) => <code className="font-bold">{c.code}</code>,
    },
    {
      key: 'name',
      header: 'Tên khuyến mãi',
      render: (c) => <span className="line-clamp-1 max-w-[200px]">{c.name}</span>,
    },
    { key: 'kind', header: 'Loại', render: (c) => KIND_LABEL[c.kind] },
    { key: 'value', header: 'Giá trị', render: (c) => <b>{valueOf(c)}</b> },
    {
      key: 'time',
      header: 'Thời gian',
      sortKey: 'startsAt',
      render: (c) => (
        <span className="whitespace-nowrap text-xs">
          {formatDate(c.startsAt)} – {c.endsAt ? formatDate(c.endsAt) : '∞'}
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Lượt dùng',
      sortKey: 'usedCount',
      render: (c) => `${c.usedCount}/${c.usageLimit ?? '∞'}`,
    },
    { key: 'status', header: 'Trạng thái', render: (c) => <StatusBadge info={couponStatus(c)} /> },
  ];
  return (
    <div>
      <PageHeader
        title="Khuyến mãi"
        description="Tạo và quản lý mã giảm giá, chương trình khuyến mãi."
        actions={
          <LinkButton href="/admin/promotions/new">
            <Icon name="plus" size={16} /> Tạo khuyến mãi
          </LinkButton>
        }
      />
      <Tabs
        className="mb-4"
        value={st.tab as 'all'}
        onChange={(t) => patch({ tab: t })}
        items={[
          { key: 'all', label: 'Tất cả', count: meta?.all },
          { key: 'active', label: 'Đang diễn ra', count: meta?.active },
          { key: 'upcoming', label: 'Sắp diễn ra', count: meta?.upcoming },
          { key: 'ended', label: 'Đã kết thúc', count: meta?.ended },
        ]}
      />
      <FilterBar
        search={{
          value: st.q,
          onChange: (v) => patch({ q: v }),
          placeholder: 'Tìm theo mã, tên khuyến mãi…',
        }}
        selects={[
          {
            key: 'kind',
            placeholder: 'Tất cả loại',
            value: st.kind,
            onChange: (v) => patch({ kind: v }),
            options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })),
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(c) => c.id}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        selectable
        selected={[]}
        sort={st.sort}
        onSort={(s) => patch({ sort: s })}
        page={list.data?.meta.page ?? st.page}
        total={list.data?.meta.total}
        onPage={(p) => patch({ page: p })}
        unit="khuyến mãi"
        actions={[
          { label: 'Sửa', onClick: (c) => router.push(`/admin/promotions/${c.id}`) },
          { label: 'Xóa / Ngừng', danger: true, onClick: setDel },
        ]}
      />
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa khuyến mãi"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>
              Xác nhận
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Xóa mã <b>{del?.code}</b>? Nếu mã đã được sử dụng, hệ thống chỉ ngừng kích hoạt để giữ lịch sử đơn
          hàng.
        </p>
      </Modal>
    </div>
  );
}
