'use client';

// Chi tiết khách hàng (WIREFRAME 7.20)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ReviewCard from '@/components/account/ReviewCard';
import KpiCard from '@/components/admin/KpiCard';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import ProductCard from '@/components/product/ProductCard';
import { formatCurrency, formatDate, formatRelativeTime, initials } from '@/lib/format';
import { orderStatusInfo, userStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';

type Tab = 'orders' | 'reviews' | 'wishlist' | 'activity';

export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const uid = Number(id);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'customer', uid], queryFn: () => adminApi.customers.get(uid) });
  const [tab, setTab] = useState<Tab>('orders');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ fullName: '', phone: '' });
  const [note, setNote] = useState('');
  const orders = useQuery({
    queryKey: ['admin', 'customer', uid, 'orders', page],
    queryFn: () => adminApi.customers.orders(uid, { page, pageSize: 5 }),
    enabled: tab === 'orders',
  });
  const reviews = useQuery({
    queryKey: ['admin', 'customer', uid, 'reviews'],
    queryFn: () => adminApi.customers.reviews(uid),
    enabled: tab === 'reviews',
  });
  const wishlist = useQuery({
    queryKey: ['admin', 'customer', uid, 'wishlist'],
    queryFn: () => adminApi.customers.wishlist(uid),
    enabled: tab === 'wishlist',
  });
  const u = q.data;
  const roleMut = useMutation({
    mutationFn: (action: 'grant' | 'revoke') =>
      action === 'grant' ? adminApi.customers.grantAdmin(uid) : adminApi.customers.revokeAdmin(uid),
    onSuccess: (r) => {
      toast.success(r.roles.includes('admin') ? 'Đã gán vai trò admin.' : 'Đã gỡ vai trò admin.');
      qc.invalidateQueries({ queryKey: ['admin', 'customer', uid] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (e) => toast.error(errorMessage(e)), // 409: tự gỡ của mình / gỡ admin cuối cùng
  });
  useEffect(() => {
    if (u) {
      setF({ fullName: u.fullName, phone: u.phone ?? '' });
      setNote(u.adminNote ?? '');
    }
  }, [u?.id]);

  const toggle = useMutation({
    mutationFn: () => adminApi.customers.setStatus(uid, u!.status === 'active' ? 'suspended' : 'active'),
    onSuccess: (d) => {
      toast.success(d.status === 'active' ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.');
      qc.invalidateQueries({ queryKey: ['admin', 'customer', uid] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminApi.customers.update(uid, body),
    onSuccess: () => {
      toast.success('Đã lưu thay đổi.');
      setEdit(false);
      qc.invalidateQueries({ queryKey: ['admin', 'customer', uid] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError)
    return q.error instanceof ApiClientError && q.error.status === 404 ? (
      <EmptyState
        icon="users"
        title="Không tìm thấy khách hàng"
        action={<LinkButton href="/admin/customers">Về danh sách</LinkButton>}
      />
    ) : (
      <ErrorState onRetry={() => q.refetch()} />
    );
  if (!u) return null;
  const avg = u.totalOrders ? Math.round(u.totalSpent / Math.max(1, u.totalOrders)) : 0;

  return (
    <div className="space-y-5">
      <div>
        <nav className="mb-2 text-sm text-muted">
          <Link href="/admin/customers" className="hover:text-primary">
            ‹ Khách hàng
          </Link>{' '}
          › <span className="font-semibold text-primary">{u.fullName}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">{u.fullName}</h1>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`mailto:${u.email}`} variant="outline" size="sm">
              <Icon name="mail" size={15} /> Gửi email
            </LinkButton>
            <Button
              variant={u.status === 'active' ? 'danger' : 'primary'}
              size="sm"
              loading={toggle.isPending}
              onClick={() => toggle.mutate()}
            >
              {u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            </Button>
            <Button size="sm" onClick={() => setEdit(true)}>
              <Icon name="edit" size={15} /> Chỉnh sửa
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <section className="card p-5 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                {initials(u.fullName)}
              </span>
              <div>
                <p className="font-bold">{u.fullName}</p>
                <p className="text-xs text-muted">Tham gia {formatDate(u.createdAt)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge
                label={u.customerGroup === 'loyal' ? 'Khách hàng thân thiết' : 'Khách hàng mới'}
                tone={u.customerGroup === 'loyal' ? 'purple' : 'blue'}
              />
              <StatusBadge info={userStatusInfo[u.status]} />
            </div>
            <dl className="mt-4 space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Email</dt>
                <dd className="truncate">{u.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Điện thoại</dt>
                <dd>{u.phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Sinh nhật</dt>
                <dd>{formatDate(u.birthday)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Giới tính</dt>
                <dd>{u.gender === 'male' ? 'Nam' : u.gender === 'female' ? 'Nữ' : '—'}</dd>
              </div>
            </dl>
          </section>
          <section className="card p-5 text-sm" data-testid="roles-section">
            <h2 className="mb-3 font-bold">Vai trò</h2>
            <p className="flex flex-wrap gap-2" data-testid="role-badges">
              {u.roles.map((r) => (
                <StatusBadge
                  key={r}
                  label={r === 'admin' ? 'Quản trị viên (admin)' : 'Khách hàng (user)'}
                  tone={r === 'admin' ? 'purple' : 'blue'}
                />
              ))}
            </p>
            <p className="mt-2 text-xs text-muted">
              Admin có đủ 6 quyền quản trị. Thay đổi có hiệu lực ngay ở yêu cầu kế tiếp của người đó. Xem{' '}
              <Link href="/admin/roles" className="text-primary hover:underline">
                vai trò & quyền
              </Link>
              .
            </p>
            {u.roles.includes('admin') ? (
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                loading={roleMut.isPending}
                onClick={() => roleMut.mutate('revoke')}
              >
                Gỡ vai trò admin
              </Button>
            ) : (
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                loading={roleMut.isPending}
                onClick={() => roleMut.mutate('grant')}
              >
                Gán vai trò admin
              </Button>
            )}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-bold">Sổ địa chỉ</h2>
            <ul className="space-y-3">
              {(
                u.addresses as Array<{
                  id: number;
                  label: string;
                  recipientName: string;
                  phone: string;
                  addressLine: string;
                  ward: string;
                  district: string;
                  province: string;
                  isDefault: boolean;
                }>
              ).map((a) => (
                <li key={a.id}>
                  <p className="font-semibold">
                    {a.label}{' '}
                    {a.isDefault && (
                      <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-normal text-white">
                        Mặc định
                      </span>
                    )}
                  </p>
                  <p className="text-muted">
                    {a.recipientName} · {a.phone}
                    <br />
                    {a.addressLine}, {a.ward}, {a.district}, {a.province}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <Textarea
              label="Ghi chú nội bộ"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              size="sm"
              className="mt-2"
              loading={save.isPending}
              onClick={() => save.mutate({ adminNote: note })}
            >
              Lưu ghi chú
            </Button>
          </section>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Tổng đơn" icon="receipt" value={String(u.totalOrders)} />
            <KpiCard label="Tổng chi tiêu" icon="dollar" value={formatCurrency(u.totalSpent)} />
            <KpiCard label="Giá trị TB/đơn" icon="chart" value={formatCurrency(avg)} />
            <KpiCard label="Điểm thưởng" icon="gift" value={u.loyaltyPoints.toLocaleString('vi-VN')} />
          </div>
          <section className="card p-5">
            <Tabs
              value={tab}
              onChange={(t) => {
                setTab(t);
                setPage(1);
              }}
              items={[
                { key: 'orders', label: 'Đơn hàng' },
                { key: 'reviews', label: 'Đánh giá' },
                { key: 'wishlist', label: 'Yêu thích' },
                { key: 'activity', label: 'Hoạt động' },
              ]}
            />
            <div className="pt-4">
              {tab === 'orders' &&
                (orders.isLoading ? (
                  <PageSkeleton />
                ) : orders.isError ? (
                  <ErrorState onRetry={() => orders.refetch()} />
                ) : orders.data?.items.length ? (
                  <>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-muted">
                        <tr>
                          <th className="py-2">Mã đơn</th>
                          <th>Ngày đặt</th>
                          <th>Tổng tiền</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {orders.data.items.map((o) => (
                          <tr key={o.id}>
                            <td className="py-2.5">
                              <Link
                                href={`/admin/orders/${o.orderCode}`}
                                className="font-semibold text-primary hover:underline"
                              >
                                #{o.orderCode}
                              </Link>
                            </td>
                            <td>{formatDate(o.createdAt)}</td>
                            <td className="font-semibold">{formatCurrency(o.total)}</td>
                            <td>
                              <StatusBadge info={orderStatusInfo[o.status]} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination
                      className="mt-4"
                      page={orders.data.meta.page}
                      totalPages={orders.data.meta.totalPages}
                      onChange={setPage}
                    />
                  </>
                ) : (
                  <EmptyState icon="receipt" title="Chưa có đơn hàng" />
                ))}
              {tab === 'reviews' &&
                (reviews.isLoading ? (
                  <PageSkeleton />
                ) : reviews.data?.length ? (
                  <div className="space-y-3">
                    {reviews.data.map((r) => (
                      <ReviewCard key={r.id} review={r} mode="mine" />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="star" title="Chưa có đánh giá" />
                ))}
              {tab === 'wishlist' &&
                (wishlist.isLoading ? (
                  <PageSkeleton />
                ) : wishlist.data?.length ? (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {wishlist.data.map((p) => (
                      <ProductCard key={p.id} product={p} compact />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="heart" title="Chưa có sản phẩm yêu thích" />
                ))}
              {tab === 'activity' &&
                (u.recentActivity.length ? (
                  <ul className="space-y-3 text-sm">
                    {u.recentActivity.map((a, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>{a.text}</span>
                        <span className="shrink-0 text-xs text-muted">{formatRelativeTime(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon="clock" title="Chưa có hoạt động" />
                ))}
            </div>
          </section>
        </div>
      </div>
      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Chỉnh sửa khách hàng"
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(false)}>
              Hủy
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate(f)}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Họ và tên"
            required
            value={f.fullName}
            onChange={(e) => setF({ ...f, fullName: e.target.value })}
          />
          <Input
            label="Số điện thoại"
            inputMode="tel"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
