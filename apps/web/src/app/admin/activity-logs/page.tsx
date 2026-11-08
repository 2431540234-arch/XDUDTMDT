'use client';

// UC-ADM-27 – Nhật ký hoạt động của quản trị viên (chỉ đọc): lọc theo admin, hành động, loại đối tượng, ngày.
// Dòng do ActivityLogInterceptor ghi (service không ghi log cho thao tác đó) hiển thị nhãn "Tự động".
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import type { ActivityLogRow } from '@/types/api';

export default function AdminActivityLogsPage() {
  const [st, patch] = useListState({
    q: '',
    sort: '',
    page: 1,
    actorId: '',
    action: '',
    targetType: '',
    from: '',
    to: '',
  });
  const action = useDebounced(st.action);
  const [open, setOpen] = useState<number | null>(null);
  const options = useQuery({
    queryKey: ['admin', 'activity-logs', 'options'],
    queryFn: () => adminApi.activityLogs.options(),
  });
  const list = useQuery({
    queryKey: ['admin', 'activity-logs', st.page, st.actorId, action, st.targetType, st.from, st.to],
    queryFn: () =>
      adminApi.activityLogs.list({
        page: st.page,
        pageSize: 20,
        actorId: st.actorId,
        action,
        targetType: st.targetType,
        from: st.from,
        to: st.to,
      }),
  });
  const columns: Column<ActivityLogRow>[] = [
    { key: 'at', header: 'Thời gian', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'actor',
      header: 'Quản trị viên',
      render: (r) => (
        <span>
          <b>{r.actorName ?? '—'}</b>
          {r.actorEmail && <span className="block text-xs text-muted">{r.actorEmail}</span>}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Hành động',
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1.5" data-testid="log-action" data-auto={r.auto}>
          <code className="text-xs font-semibold">{r.action}</code>
          {r.auto ? (
            <StatusBadge label="Tự động" tone="yellow" />
          ) : (
            <StatusBadge label="Dịch vụ ghi" tone="green" />
          )}
        </span>
      ),
    },
    {
      key: 'target',
      header: 'Đối tượng',
      render: (r) => (r.targetType ? `${r.targetType}${r.targetId ? ` #${r.targetId}` : ''}` : '—'),
    },
    { key: 'ip', header: 'IP', render: (r) => r.ipAddress ?? '—' },
    {
      key: 'changes',
      header: 'Nội dung thay đổi',
      render: (r) =>
        r.changes ? (
          <button
            type="button"
            className="text-left text-xs text-primary hover:underline"
            aria-expanded={open === r.id}
            onClick={() => setOpen(open === r.id ? null : r.id)}
          >
            {open === r.id ? (
              <pre className="max-w-md whitespace-pre-wrap break-all text-ink">
                {JSON.stringify(r.changes, null, 2)}
              </pre>
            ) : (
              'Xem chi tiết'
            )}
          </button>
        ) : (
          '—'
        ),
    },
  ];
  return (
    <div>
      <PageHeader
        title="Nhật ký hoạt động"
        description="Tra cứu ai làm gì, trên đối tượng nào, nội dung thay đổi và IP. Chỉ đọc."
      />
      <FilterBar
        search={{
          value: st.action,
          onChange: (v) => patch({ action: v }),
          placeholder: 'Lọc theo hành động (vd. brand, order)…',
        }}
        selects={[
          {
            key: 'actor',
            placeholder: 'Tất cả quản trị viên',
            value: st.actorId,
            onChange: (v) => patch({ actorId: v }),
            options: (options.data?.actors ?? []).map((a) => ({ value: String(a.id), label: a.fullName })),
          },
          {
            key: 'type',
            placeholder: 'Tất cả loại đối tượng',
            value: st.targetType,
            onChange: (v) => patch({ targetType: v }),
            options: (options.data?.targetTypes ?? []).map((t) => ({ value: t, label: t })),
          },
        ]}
        dateRange={{ from: st.from, to: st.to, onChange: (from, to) => patch({ from, to }) }}
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        page={list.data?.meta.page ?? st.page}
        total={list.data?.meta.total}
        pageSize={20}
        onPage={(p) => patch({ page: p })}
        unit="dòng nhật ký"
      />
    </div>
  );
}
