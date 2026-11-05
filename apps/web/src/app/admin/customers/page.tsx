'use client';

// Quản lý khách hàng – danh sách (WIREFRAME 3.6)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatCurrency, initials } from '@/lib/format';
import { userStatusInfo } from '@/lib/status';
import { emailSchema, errorMessage, phoneSchema, requiredText } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { ApiClientError } from '@/services/api-client';
import { toast } from '@/store/uiStore';
import type { UserView } from '@/types/api';

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ fullName: '', email: '', phone: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => adminApi.customers.create(v),
    onSuccess: () => {
      toast.success('Đã thêm khách hàng.');
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
      setV({ fullName: '', email: '', phone: '' });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') setErrs(e.fieldErrors());
      else if (e instanceof ApiClientError && e.code === 'EMAIL_ALREADY_EXISTS')
        setErrs({ email: e.message });
      else toast.error(errorMessage(e));
    },
  });
  const submit = () => {
    const x: Record<string, string> = {};
    const n = requiredText('Họ và tên', 2).safeParse(v.fullName);
    if (!n.success) x.fullName = n.error.issues[0].message;
    const e = emailSchema.safeParse(v.email);
    if (!e.success) x.email = e.error.issues[0].message;
    const p = phoneSchema.safeParse(v.phone);
    if (!p.success) x.phone = p.error.issues[0].message;
    setErrs(x);
    if (!Object.keys(x).length) create.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm khách hàng"
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Thêm khách hàng
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Họ và tên"
          required
          value={v.fullName}
          onChange={(e) => {
            setV({ ...v, fullName: e.target.value });
            setErrs({ ...errs, fullName: '' });
          }}
          error={errs.fullName}
        />
        <Input
          label="Email"
          required
          type="email"
          value={v.email}
          onChange={(e) => {
            setV({ ...v, email: e.target.value });
            setErrs({ ...errs, email: '' });
          }}
          error={errs.email}
        />
        <Input
          label="Số điện thoại"
          required
          inputMode="tel"
          value={v.phone}
          onChange={(e) => {
            setV({ ...v, phone: e.target.value });
            setErrs({ ...errs, phone: '' });
          }}
          error={errs.phone}
        />
        <p className="text-xs text-muted">Mật khẩu tạm thời: 12345678 (khách nên đổi sau khi đăng nhập).</p>
      </div>
    </Modal>
  );
}

export default function AdminCustomersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: 'createdAt:desc', group: '', status: '' });
  const q = useDebounced(st.q);
  const [create, setCreate] = useState(false);
  const list = useQuery({
    queryKey: ['admin', 'customers', q, st.page, st.sort, st.group, st.status],
    queryFn: () =>
      adminApi.customers.list({
        q,
        page: st.page,
        pageSize: 10,
        sort: st.sort,
        group: st.group,
        status: st.status,
      }),
  });
  const toggle = useMutation({
    mutationFn: (u: UserView) =>
      adminApi.customers.setStatus(u.id, u.status === 'active' ? 'suspended' : 'active'),
    onSuccess: (u) => {
      toast.success(u.status === 'active' ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.');
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: Column<UserView>[] = [
    {
      key: 'name',
      header: 'Tên khách hàng',
      sortKey: 'fullName',
      render: (u) => (
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {initials(u.fullName)}
          </span>
          <Link href={`/admin/customers/${u.id}`} className="font-semibold hover:text-primary">
            {u.fullName}
          </Link>
        </span>
      ),
    },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'phone', header: 'Số điện thoại', render: (u) => u.phone ?? '—' },
    {
      key: 'group',
      header: 'Nhóm',
      render: (u) => (
        <StatusBadge
          label={u.customerGroup === 'loyal' ? 'Khách hàng thân thiết' : 'Khách hàng mới'}
          tone={u.customerGroup === 'loyal' ? 'purple' : 'blue'}
        />
      ),
    },
    { key: 'orders', header: 'Tổng đơn', sortKey: 'totalOrders', render: (u) => u.totalOrders },
    {
      key: 'spent',
      header: 'Tổng chi tiêu',
      sortKey: 'totalSpent',
      render: (u) => <b>{formatCurrency(u.totalSpent)}</b>,
    },
    { key: 'status', header: 'Trạng thái', render: (u) => <StatusBadge info={userStatusInfo[u.status]} /> },
  ];
  return (
    <div>
      <PageHeader title="Khách hàng" description="Quản lý tài khoản khách hàng và lịch sử mua sắm." />
      <FilterBar
        search={{
          value: st.q,
          onChange: (v) => patch({ q: v }),
          placeholder: 'Tìm theo tên, email, số điện thoại…',
        }}
        selects={[
          {
            key: 'group',
            placeholder: 'Tất cả nhóm',
            value: st.group,
            onChange: (v) => patch({ group: v }),
            options: [
              { value: 'loyal', label: 'Khách hàng thân thiết' },
              { value: 'new', label: 'Khách hàng mới' },
            ],
          },
          {
            key: 'status',
            placeholder: 'Tất cả trạng thái',
            value: st.status,
            onChange: (v) => patch({ status: v }),
            options: [
              { value: 'active', label: 'Hoạt động' },
              { value: 'inactive', label: 'Không hoạt động' },
            ],
          },
        ]}
        actions={
          <Button onClick={() => setCreate(true)}>
            <Icon name="plus" size={16} /> Thêm khách hàng
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(u) => u.id}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        sort={st.sort}
        onSort={(s) => patch({ sort: s })}
        page={list.data?.meta.page ?? st.page}
        total={list.data?.meta.total}
        onPage={(p) => patch({ page: p })}
        unit="khách hàng"
        actions={[
          { label: 'Xem chi tiết', onClick: (u) => router.push(`/admin/customers/${u.id}`) },
          { label: 'Khóa / Mở khóa', onClick: (u) => toggle.mutate(u) },
        ]}
      />
      <CreateModal open={create} onClose={() => setCreate(false)} />
    </div>
  );
}
