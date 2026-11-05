'use client';

// Thông báo (WIREFRAME 7.10)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Icon, { type IconName } from '@/components/ui/Icon';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { queryKeys } from '@/hooks/useCart';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { notificationApi } from '@/services/content.api';
import { toast } from '@/store/uiStore';

type Tab = 'all' | 'order' | 'promo' | 'system';
const ICON: Record<'order' | 'promo' | 'system', { icon: IconName; cls: string }> = {
  order: { icon: 'box', cls: 'bg-sky-100 text-sky-700' },
  promo: { icon: 'gift', cls: 'bg-orange-100 text-orange-700' },
  system: { icon: 'info', cls: 'bg-stone-200 text-stone-700' },
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [...queryKeys.notifications, tab, page],
    queryFn: () => notificationApi.list({ type: tab === 'all' ? undefined : tab, page, pageSize: 8 }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.notifications });
  const readAll = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      toast.success('Đã đánh dấu tất cả là đã đọc.');
      refresh();
      qc.invalidateQueries({ queryKey: queryKeys.unread });
    },
  });
  const read = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: queryKeys.unread });
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Thông báo</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" loading={readAll.isPending} onClick={() => readAll.mutate()}>
            Đánh dấu tất cả đã đọc
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Cài đặt thông báo sẽ có trong phiên bản sau.')}
          >
            <Icon name="settings" size={15} /> Cài đặt thông báo
          </Button>
        </div>
      </div>
      <Tabs
        className="mt-4"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        items={[
          { key: 'all', label: 'Tất cả' },
          { key: 'order', label: 'Đơn hàng' },
          { key: 'promo', label: 'Khuyến mãi' },
          { key: 'system', label: 'Hệ thống' },
        ]}
      />
      <div className="mt-4">
        {q.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.data?.items.length ? (
          <>
            <ul className="card divide-y divide-line overflow-hidden">
              {q.data.items.map((n) => {
                const ic = ICON[n.data.type];
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.readAt) read.mutate(n.id);
                        if (n.data.link) router.push(n.data.link);
                      }}
                      className={cn(
                        'flex w-full items-start gap-4 p-4 text-left hover:bg-surface-muted/50',
                        !n.readAt && 'bg-primary-soft/40',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                          ic.cls,
                        )}
                      >
                        <Icon name={ic.icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{n.title}</span>
                        <span className="block text-sm text-muted">{n.data.content}</span>
                        <span className="mt-1 block text-xs text-muted">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </span>
                      {!n.readAt && (
                        <span
                          className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-danger"
                          aria-label="Chưa đọc"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination
              className="mt-6"
              page={q.data.meta.page}
              totalPages={q.data.meta.totalPages}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon="bell"
            title="Chưa có thông báo"
            description="Các thông báo về đơn hàng và khuyến mãi sẽ hiển thị tại đây."
          />
        )}
      </div>
    </div>
  );
}
