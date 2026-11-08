'use client';

// UC-ADM-02 – Vai trò và phân quyền (CHỈ XEM): 2 vai trò (admin, user) và 6 quyền. Gán/gỡ vai trò admin cho từng người
// nằm ở mục "Vai trò" trong chi tiết khách hàng (/admin/customers/:id).
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/admin/FilterBar';
import Icon from '@/components/ui/Icon';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { adminApi } from '@/services/admin.api';

export default function AdminRolesPage() {
  const q = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminApi.roles.list() });
  return (
    <div>
      <PageHeader
        title="Vai trò & quyền"
        description="Hệ thống chỉ có hai vai trò: admin và user. Admin có đủ 6 quyền; user không có quyền quản trị nào."
      />
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {q.data?.map((r) => (
            <section key={r.id} className="card p-5" data-testid={`role-${r.code}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold">
                  {r.name} <code className="ml-1 text-xs font-semibold text-muted">{r.code}</code>
                </h2>
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  {r.userCount} người dùng
                </span>
              </div>
              {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
              <h3 className="mb-2 mt-4 text-sm font-bold">Quyền ({r.permissions.length})</h3>
              {r.permissions.length === 0 ? (
                <p className="text-sm text-muted">Không có quyền quản trị nào.</p>
              ) : (
                <ul className="space-y-2">
                  {r.permissions.map((p) => (
                    <li key={p.code} className="flex gap-2 text-sm">
                      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>
                        <b>{p.name}</b> <code className="text-xs text-muted">{p.code}</code>
                        {p.description && <span className="block text-xs text-muted">{p.description}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
