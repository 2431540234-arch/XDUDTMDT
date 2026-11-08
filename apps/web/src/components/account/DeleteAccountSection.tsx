'use client';

// UC-ACC-07 – Xóa tài khoản (xóa mềm): nhập mật khẩu xác nhận; còn đơn đang xử lý thì máy chủ trả 409; xong thì đăng xuất.
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError } from '@/services/api-client';
import { errorMessage } from '@/lib/validators';
import { userApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

export default function DeleteAccountSection() {
  const router = useRouter();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const del = useMutation({
    mutationFn: () => userApi.deleteAccount(password),
    onSuccess: async () => {
      toast.success('Tài khoản đã được xóa. Hẹn gặp lại bạn!');
      setOpen(false);
      await logout(); // phiên đã bị thu hồi ở máy chủ; xóa phiên cục bộ rồi về trang chủ
      router.replace('/');
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED')
        setError(e.fieldErrors().password ?? errorMessage(e));
      else setError(errorMessage(e)); // gồm 409 "Bạn còn N đơn hàng đang xử lý…"
    },
  });
  const close = () => {
    setOpen(false);
    setPassword('');
    setError('');
  };
  return (
    <section className="card border-danger/30 p-5 sm:p-6" aria-labelledby="xoa-tai-khoan">
      <h2 id="xoa-tai-khoan" className="text-xl font-extrabold text-danger">
        Xóa tài khoản
      </h2>
      <p className="mt-1 text-sm text-muted">
        Tài khoản sẽ bị đóng và mọi thiết bị bị đăng xuất. Đơn hàng cũ của bạn vẫn được giữ lại. Bạn không thể
        xóa khi còn đơn đang xử lý hoặc đang giao.
      </p>
      <Button className="mt-4" variant="danger" onClick={() => setOpen(true)}>
        Xóa tài khoản
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Xóa tài khoản"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => {
                if (!password) return setError('Vui lòng nhập mật khẩu để xác nhận.');
                setError('');
                del.mutate();
              }}
            >
              Xác nhận xóa
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm">
          Nhập mật khẩu để xác nhận xóa tài khoản. Thao tác này không thể hoàn tác.
        </p>
        <Input
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
      </Modal>
    </section>
  );
}
