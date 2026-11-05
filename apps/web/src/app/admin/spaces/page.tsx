'use client';

// Quản lý không gian mẫu – danh sách (WIREFRAME 3.3a)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useDebounced, useListState } from '@/hooks/useListState';
import { contentStatusInfo, roomTypeLabel } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { SpaceListItem } from '@/types/api';

export default function AdminSpacesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: 'createdAt:desc', roomType: '', status: '' });
  const q = useDebounced(st.q);
  const [del, setDel] = useState<SpaceListItem | null>(null);
  const list = useQuery({
    queryKey: ['admin', 'spaces', q, st.page, st.sort, st.roomType, st.status],
    queryFn: () =>
      adminApi.spaces.list({
        q,
        page: st.page,
        pageSize: 10,
        sort: st.sort,
        roomType: st.roomType,
        status: st.status,
      }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.spaces.remove(id),
    onSuccess: () => {
      toast.success('Đã xóa không gian mẫu.');
      setDel(null);
      qc.invalidateQueries({ queryKey: ['admin', 'spaces'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: Column<SpaceListItem>[] = [
    {
      key: 'img',
      header: 'Ảnh đại diện',
      render: (s) => (
        <span className="block h-12 w-16 overflow-hidden rounded-md bg-surface-muted">
          {s.coverUrl && <img src={s.coverUrl} alt="" className="h-full w-full object-cover" />}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Tên không gian',
      sortKey: 'title',
      render: (s) => (
        <Link href={`/admin/spaces/${s.id}`} className="font-semibold hover:text-primary">
          {s.title}
        </Link>
      ),
    },
    { key: 'type', header: 'Loại', render: (s) => roomTypeLabel[s.roomType] },
    { key: 'pano', header: 'Số ảnh 360°', render: (s) => s.panoramaCount },
    { key: 'prod', header: 'Số sản phẩm', render: (s) => s.productCount },
    {
      key: 'views',
      header: 'Lượt xem',
      sortKey: 'viewCount',
      render: (s) => s.viewCount.toLocaleString('vi-VN'),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (s) => <StatusBadge info={contentStatusInfo[s.status]} />,
    },
  ];
  return (
    <div>
      <PageHeader title="Không gian mẫu" description="Quản lý các không gian trải nghiệm 3D và ảnh 360°." />
      <FilterBar
        search={{ value: st.q, onChange: (v) => patch({ q: v }), placeholder: 'Tìm theo tên không gian…' }}
        selects={[
          {
            key: 'type',
            placeholder: 'Tất cả loại không gian',
            value: st.roomType,
            onChange: (v) => patch({ roomType: v }),
            options: Object.entries(roomTypeLabel).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'status',
            placeholder: 'Tất cả trạng thái',
            value: st.status,
            onChange: (v) => patch({ status: v }),
            options: Object.entries(contentStatusInfo).map(([value, i]) => ({ value, label: i.label })),
          },
        ]}
        actions={
          <LinkButton href="/admin/spaces/new">
            <Icon name="plus" size={16} /> Thêm không gian mẫu
          </LinkButton>
        }
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(s) => s.id}
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
        unit="không gian"
        actions={[
          { label: 'Sửa', onClick: (s) => router.push(`/admin/spaces/${s.id}`) },
          {
            label: 'Xem trên website',
            hidden: (s) => s.status !== 'published',
            onClick: (s) => window.open(`/spaces/${s.slug}`, '_blank'),
          },
          { label: 'Xóa', danger: true, onClick: setDel },
        ]}
      />
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa không gian mẫu"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Xóa không gian <b>{del?.title}</b> cùng ảnh 360° và điểm tương tác?
        </p>
      </Modal>
    </div>
  );
}
