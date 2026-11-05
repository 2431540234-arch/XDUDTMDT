'use client';

// Quên mật khẩu (WIREFRAME 7.3): nhập email → gửi OTP 6 số
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import { applyApiErrors, emailSchema, errorMessage } from '@/lib/validators';
import { authApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

const schema = z.object({ email: emailSchema });

export default function ForgotPasswordPage() {
  const router = useRouter();
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => authApi.forgotPassword(v.email),
    onSuccess: (_d, v) => {
      toast.success('Đã gửi mã xác thực. Vui lòng kiểm tra email.');
      router.push(`/reset-password?email=${encodeURIComponent(v.email)}`);
    },
    onError: (e) => {
      if (!applyApiErrors(e, f.setError)) toast.error(errorMessage(e));
    },
  });
  return (
    <AuthLayout title="Quên mật khẩu">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-primary">
        <Icon name="key" size={28} />
      </div>
      <h1 className="text-2xl font-extrabold tracking-wide">QUÊN MẬT KHẨU</h1>
      <p className="mt-1 text-sm text-muted">
        Nhập email đã đăng ký, chúng tôi sẽ gửi mã OTP gồm 6 số để bạn đặt lại mật khẩu.
      </p>
      <form className="mt-6 space-y-4" noValidate onSubmit={f.handleSubmit((v) => send.mutate(v))}>
        <Input
          label="Email"
          required
          type="email"
          icon="mail"
          autoComplete="email"
          placeholder="khachhang@aurelia.vn"
          error={f.formState.errors.email?.message}
          {...f.register('email')}
        />
        <Button type="submit" block size="lg" loading={send.isPending}>
          Gửi mã xác thực
        </Button>
      </form>
      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name="arrowLeft" size={16} /> Quay lại Đăng nhập
      </Link>
    </AuthLayout>
  );
}
