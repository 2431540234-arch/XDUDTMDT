'use client';

// Quản lý đánh giá (WIREFRAME 3.7)
// Lưu ý: nút "+ Thêm đánh giá" của wireframe không dựng vì DECISIONS D-N06: chỉ khách đã mua (đơn hoàn tất) mới được đánh giá.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Modal from '@/components/ui/Modal';
import StarRating from '@/components/ui/StarRating';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatDate } from '@/lib/format';
import { reviewStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { ReviewView } from '@/types/api';
import type { ReviewStatus } from '@aurelia-living/shared-types';

export default function AdminReviewsPage() {
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: 'createdAt:desc', status: '', rating: '' });
  const q = useDebounced(st.q);
  const [view, setView] = useState<ReviewView | null>(null);
  const list = useQuery({
    queryKey: ['admin', 'reviews', q, st.page, st.sort, st.status],
    queryFn: () =>
      adminApi.reviews.list({ q, page: st.page, pageSize: 10, sort: st.sort, status: st.status }),
  });
  const set = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ReviewStatus }) =>
      adminApi.reviews.setStatus(id, status),
    onSuccess: (r) => {
      toast.success(
        r.status === 'approved'
          ? 'Đã duyệt và hiển thị đánh giá.'
          : r.status === 'rejected'
            ? 'Đã ẩn đánh giá.'
            : 'Đã chuyển về chờ duyệt.',
      );
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      setView(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: Column<ReviewView>[] = [
    {
      key: 'p',
      header: 'Sản phẩm',
      render: (r) => (
        <span className="flex items-center gap-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-muted">
            {r.productImageUrl && (
              <img src={r.productImageUrl} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <Link
            href={`/products/${r.productSlug}`}
            className="line-clamp-1 max-w-[180px] font-semibold hover:text-primary"
          >
            {r.productName}
          </Link>
        </span>
      ),
    },
    { key: 'u', header: 'Khách hàng', render: (r) => r.userName },
    { key: 'r', header: 'Số sao', sortKey: 'rating', render: (r) => <StarRating value={r.rating} /> },
    {
      key: 'c',
      header: 'Nội dung',
      render: (r) => <span className="line-clamp-1 max-w-[260px] text-muted">{r.content}…</span>,
    },
    { key: 'd', header: 'Ngày đánh giá', sortKey: 'createdAt', render: (r) => formatDate(r.createdAt) },
    { key: 's', header: 'Trạng thái', render: (r) => <StatusBadge info={reviewStatusInfo[r.status]} /> },
  ];
  return (
    <div>
      <PageHeader title="Đánh giá" description="Duyệt và quản lý đánh giá sản phẩm từ khách hàng." />
      <FilterBar
        search={{
          value: st.q,
          onChange: (v) => patch({ q: v }),
          placeholder: 'Tìm theo tên sản phẩm, khách hàng…',
        }}
        selects={[
          {
            key: 'status',
            placeholder: 'Tất cả trạng thái',
            value: st.status,
            onChange: (v) => patch({ status: v }),
            options: Object.entries(reviewStatusInfo).map(([value, i]) => ({ value, label: i.label })),
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
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
        unit="đánh giá"
        actions={[
          { label: 'Xem chi tiết', onClick: setView },
          {
            label: 'Duyệt / Hiển thị',
            hidden: (r) => r.status === 'approved',
            onClick: (r) => set.mutate({ id: r.id, status: 'approved' }),
          },
          {
            label: 'Ẩn đánh giá',
            hidden: (r) => r.status === 'rejected',
            danger: true,
            onClick: (r) => set.mutate({ id: r.id, status: 'rejected' }),
          },
        ]}
      />
      <Modal
        open={Boolean(view)}
        onClose={() => setView(null)}
        title="Chi tiết đánh giá"
        width={560}
        footer={
          view && (
            <>
              <Button
                variant="danger"
                size="sm"
                disabled={view.status === 'rejected'}
                loading={set.isPending}
                onClick={() => set.mutate({ id: view.id, status: 'rejected' })}
              >
                Ẩn
              </Button>
              <Button
                size="sm"
                disabled={view.status === 'approved'}
                loading={set.isPending}
                onClick={() => set.mutate({ id: view.id, status: 'approved' })}
              >
                Duyệt & hiển thị
              </Button>
            </>
          )
        }
      >
        {view && (
          <div className="space-y-3 text-sm">
            <p className="font-bold">
              {view.productName} <span className="font-normal text-muted">· {view.variantLabel}</span>
            </p>
            <StarRating value={view.rating} size={18} />
            <p>{view.content}</p>
            {view.images.length > 0 && (
              <div className="flex gap-2">
                {view.images.map((s, i) => (
                  <img key={i} src={s} alt="" className="h-20 w-20 rounded-md object-cover" />
                ))}
              </div>
            )}
            <p className="text-xs text-muted">
              {view.userName} · Đơn #{view.orderCode} · {formatDate(view.createdAt)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
