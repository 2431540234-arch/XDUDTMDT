'use client';

// Đặt lại mật khẩu (WIREFRAME 7.4): mở từ liên kết trong email (?token=…), nhập mật khẩu mới + thanh độ mạnh
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { PASSWORD_POLICY_MESSAGE, errorMessage, isStrongPassword, passwordStrength } from '@/lib/validators';
import { authApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

function Form() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});

  const strength = passwordStrength(pw);
  const reset = useMutation({
    mutationFn: () => authApi.resetPassword({ token, newPassword: pw, confirmPassword: confirm }),
    onSuccess: () => {
      toast.success('Đặt lại mật khẩu thành công. Vui lòng đăng nhập.');
      router.replace('/login');
    },
    onError: (e) => setErrs({ form: errorMessage(e) }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!isStrongPassword(pw)) x.password = PASSWORD_POLICY_MESSAGE;
    if (confirm !== pw) x.confirm = 'Mật khẩu xác nhận không khớp.';
    setErrs(x);
    if (!Object.keys(x).length) reset.mutate();
  };

  if (!token) {
    return (
      <div>
        <p className="text-sm text-muted">
          Liên kết đặt lại mật khẩu không hợp lệ. Vui lòng bắt đầu lại từ bước “Quên mật khẩu”.
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-block font-semibold text-primary hover:underline"
        >
          Quên mật khẩu
        </Link>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-wide">ĐẶT LẠI MẬT KHẨU</h1>
      <p className="mt-1 text-sm text-muted">Nhập mật khẩu mới cho tài khoản của bạn.</p>
      <form className="mt-6 space-y-4" noValidate onSubmit={submit}>
        {errs.form && (
          <p role="alert" className="rounded-btn bg-rose-50 px-3 py-2 text-sm text-danger">
            {errs.form}{' '}
            <Link href="/forgot-password" className="font-semibold underline">
              Gửi lại liên kết
            </Link>
          </p>
        )}
        <div>
          <Input
            label="Mật khẩu mới"
            required
            type="password"
            icon="lock"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            error={errs.password}
          />
          {pw && (
            <div className="mt-2" aria-live="polite">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      'h-1.5 flex-1 rounded-full',
                      n <= strength.score
                        ? strength.score <= 1
                          ? 'bg-danger'
                          : strength.score === 2
                            ? 'bg-star'
                            : 'bg-emerald-500'
                        : 'bg-line',
                    )}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                Độ mạnh: <b>{strength.label}</b>
              </p>
            </div>
          )}
        </div>
        <Input
          label="Xác nhận mật khẩu mới"
          required
          type="password"
          icon="lock"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errs.confirm}
        />
        <Button type="submit" block size="lg" loading={reset.isPending}>
          Đặt lại mật khẩu
        </Button>
      </form>
      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name="arrowLeft" size={16} /> Quay lại Đăng nhập
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Đặt lại mật khẩu">
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </AuthLayout>
  );
}
