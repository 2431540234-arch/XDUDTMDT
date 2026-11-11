'use client';

// UC-ACC-03 – Quản lý phiên đăng nhập (đăng xuất từ xa): các thiết bị đang đăng nhập của CHÍNH tôi.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { userApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

export default function SessionsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'sessions'], queryFn: () => userApi.sessions() });
  const revoke = useMutation({
    mutationFn: (id: number) => userApi.revokeSession(id),
    onSuccess: () => {
      toast.success('Đã đăng xuất thiết bị.');
      qc.invalidateQueries({ queryKey: ['me', 'sessions'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Phiên đăng nhập</h1>
      <p className="mt-1 text-sm text-muted">
        Các thiết bị đang đăng nhập vào tài khoản của bạn. Nếu thấy thiết bị lạ, hãy đăng xuất thiết bị đó và
        đổi mật khẩu.
      </p>
      <div className="mt-5 space-y-3">
        {q.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.data?.length ? (
          <EmptyState title="Không có phiên đăng nhập nào" />
        ) : (
          <ul className="space-y-3" aria-label="Danh sách phiên đăng nhập">
            {q.data.map((s) => (
              <li
                key={s.id}
                className="card flex flex-wrap items-center gap-4 p-4"
                data-testid="session-row"
                data-current={s.current}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon name="user" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.deviceName}
                    {s.current && <StatusBadge label="Thiết bị này" tone="green" />}
                  </p>
                  <p className="text-xs text-muted">
                    IP {s.ipAddress ?? '—'} · Đăng nhập {formatDateTime(s.createdAt)} · Hết hạn{' '}
                    {formatDateTime(s.expiresAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Đăng xuất thiết bị ${s.deviceName} #${s.id}`}
                  loading={revoke.isPending && revoke.variables === s.id}
                  onClick={() => revoke.mutate(s.id)}
                >
                  Đăng xuất thiết bị
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
