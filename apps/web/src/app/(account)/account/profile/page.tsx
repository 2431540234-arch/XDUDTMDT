'use client';

// Thông tin cá nhân + địa chỉ + đơn hàng gần đây (WIREFRAME 2.8)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import AddressFormModal from '@/components/account/AddressFormModal';
import { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { orderStatusInfo } from '@/lib/status';
import { applyApiErrors, errorMessage, phoneSchema, requiredText } from '@/lib/validators';
import { addressApi, authApi, userApi } from '@/services/auth.api';
import { orderApi } from '@/services/cart.api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import type { AddressView } from '@/types/api';

const schema = z.object({
  fullName: requiredText('Họ và tên', 2),
  gender: z.string().optional(),
  birthday: z.string().optional(),
  phone: phoneSchema,
});
type Values = z.infer<typeof schema>;

function ProfileCard() {
  const qc = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const me = useQuery({ queryKey: ['me'], queryFn: userApi.me });
  const [edit, setEdit] = useState(false);
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (r) =>
      toast.success(
        r.verified ? 'Email của bạn đã được xác thực.' : 'Đã gửi email xác thực. Vui lòng kiểm tra hộp thư.',
      ),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const f = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (me.data)
      f.reset({
        fullName: me.data.fullName,
        gender: me.data.gender ?? '',
        birthday: me.data.birthday ?? '',
        phone: me.data.phone ?? '',
      });
  }, [me.data, edit]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      userApi.update({
        fullName: v.fullName,
        phone: v.phone,
        gender: (v.gender || null) as never,
        birthday: v.birthday || null,
      }),
    onSuccess: (u) => {
      patchUser({ fullName: u.fullName, phone: u.phone });
      qc.setQueryData(['me'], u);
      toast.success('Đã cập nhật thông tin cá nhân.');
      setEdit(false);
    },
    onError: (e) => {
      if (!applyApiErrors(e, f.setError)) toast.error(errorMessage(e));
    },
  });
  const avatar = useMutation({
    mutationFn: (url: string) => userApi.update({ avatarUrl: url }),
    onSuccess: (u) => {
      patchUser({ avatarUrl: u.avatarUrl });
      qc.setQueryData(['me'], u);
      toast.success('Đã đổi ảnh đại diện.');
    },
  });
  const onAvatar = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast.error('Chỉ nhận ảnh JPG hoặc PNG.');
    if (file.size > 2 * 1024 * 1024) return toast.error('Ảnh đại diện tối đa 2MB.');
    avatar.mutate(await readAsDataUrl(file));
  };

  if (me.isLoading) return <Skeleton className="h-64 w-full" />;
  if (me.isError) return <ErrorState onRetry={() => me.refetch()} />;
  const u = me.data!;
  const err = f.formState.errors;
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Thông tin cá nhân</h1>
        {!edit && (
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            <Icon name="edit" size={15} /> Chỉnh sửa
          </Button>
        )}
      </div>
      {me.data && !me.data.emailVerifiedAt && (
        <div
          role="status"
          className="mb-5 flex flex-wrap items-center gap-3 rounded-btn bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span className="flex-1">
            Email <b>{me.data.email}</b> chưa được xác thực. Bạn cần xác thực email để đánh giá sản phẩm.
          </span>
          <Button size="sm" variant="outline" loading={resend.isPending} onClick={() => resend.mutate()}>
            Gửi lại email xác thực
          </Button>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-primary text-3xl font-bold text-white">
            {u.avatarUrl && !u.avatarUrl.includes('/mock-img/avatar') ? (
              <img src={u.avatarUrl} alt="Ảnh đại diện" className="h-full w-full object-cover" />
            ) : (
              initials(u.fullName)
            )}
          </div>
          <label className="mt-3 cursor-pointer text-sm font-medium text-primary hover:underline">
            Thay đổi ảnh đại diện
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg"
              onChange={(e) => onAvatar(e.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-muted">JPG/PNG, tối đa 2MB</p>
        </div>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={f.handleSubmit((v) => save.mutate(v))}
        >
          <Input
            label="Họ và tên"
            required
            disabled={!edit}
            error={err.fullName?.message}
            {...f.register('fullName')}
          />
          <Select
            label="Giới tính"
            disabled={!edit}
            placeholder="Chọn giới tính"
            options={[
              { value: 'male', label: 'Nam' },
              { value: 'female', label: 'Nữ' },
              { value: 'other', label: 'Khác' },
            ]}
            {...f.register('gender')}
          />
          <Input label="Email" value={u.email} disabled readOnly />
          <Input label="Ngày sinh" type="date" disabled={!edit} {...f.register('birthday')} />
          <Input
            label="Số điện thoại"
            required
            disabled={!edit}
            inputMode="tel"
            error={err.phone?.message}
            {...f.register('phone')}
          />
          <Input label="Vai trò" value="Khách hàng" disabled readOnly />
          {edit && (
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={save.isPending}>
                Lưu thay đổi
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEdit(false);
                  f.clearErrors();
                }}
              >
                Hủy
              </Button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function Addresses() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['addresses'], queryFn: addressApi.list });
  const [modal, setModal] = useState<{ open: boolean; address: AddressView | null }>({
    open: false,
    address: null,
  });
  const [del, setDel] = useState<AddressView | null>(null);
  const setDefault = useMutation({
    mutationFn: (id: number) => addressApi.setDefault(id),
    onSuccess: () => {
      toast.success('Đã đặt làm địa chỉ mặc định.');
      qc.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => addressApi.remove(id),
    onSuccess: () => {
      toast.success('Đã xóa địa chỉ.');
      setDel(null);
      qc.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDel(null);
    },
  });
  return (
    <section id="dia-chi" className="card scroll-mt-24 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Địa chỉ của tôi</h2>
        <Button size="sm" onClick={() => setModal({ open: true, address: null })}>
          <Icon name="plus" size={15} /> Thêm địa chỉ mới
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((a) => (
            <article
              key={a.id}
              className={cn(
                'rounded-card border p-4 text-sm',
                a.isDefault ? 'border-primary bg-primary-soft/30' : 'border-line',
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="font-bold">{a.label}</span>
                {a.isDefault && (
                  <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-white">Mặc định</span>
                )}
              </div>
              <p className="font-semibold">
                {a.recipientName} · {a.phone}
              </p>
              <p className="text-muted">
                {a.addressLine}, {a.ward}, {a.district}, {a.province}
              </p>
              <div className="mt-3 flex gap-3 text-xs font-semibold">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setModal({ open: true, address: a })}
                >
                  Sửa
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setDefault.mutate(a.id)}
                  >
                    Đặt mặc định
                  </button>
                )}
                <button type="button" className="text-danger hover:underline" onClick={() => setDel(a)}>
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon="pin" title="Chưa có địa chỉ" description="Thêm địa chỉ để đặt hàng nhanh hơn." />
      )}
      <AddressFormModal
        open={modal.open}
        address={modal.address}
        onClose={() => setModal({ open: false, address: null })}
      />
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa địa chỉ"
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
        <p className="text-sm">Bạn chắc chắn muốn xóa địa chỉ “{del?.label}”?</p>
      </Modal>
    </section>
  );
}

function RecentOrders() {
  const q = useQuery({ queryKey: ['orders', 'recent'], queryFn: () => orderApi.list({ pageSize: 5 }) });
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Đơn hàng gần đây</h2>
        <Link href="/account/orders" className="text-sm font-semibold text-primary hover:underline">
          Xem tất cả →
        </Link>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data?.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Mã đơn</th>
                <th>Ngày đặt</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {q.data.items.map((o) => (
                <tr key={o.id}>
                  <td className="py-3 font-semibold">#{o.orderCode}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td className="font-semibold">{formatCurrency(o.total)}</td>
                  <td>
                    <StatusBadge info={orderStatusInfo[o.status]} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/account/orders/${o.orderCode}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      Xem chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="receipt" title="Chưa có đơn hàng" />
      )}
    </section>
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <ProfileCard />
      <Addresses />
      <RecentOrders />
    </div>
  );
}
