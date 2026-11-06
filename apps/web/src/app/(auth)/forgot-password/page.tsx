'use client';

// Quên mật khẩu (WIREFRAME 7.3): nhập email → hệ thống gửi email chứa liên kết đặt lại mật khẩu (token, D-T29)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import { applyApiErrors, emailSchema, errorMessage } from '@/lib/validators';
import { USE_MOCK } from '@/services/api-client';
import { authApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

const schema = z.object({ email: emailSchema });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<{ email: string; devLink?: string } | null>(null);
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => authApi.forgotPassword(v.email),
    onSuccess: (d, v) => {
      toast.success('Đã gửi email hướng dẫn. Vui lòng kiểm tra hộp thư.');
      setSent({ email: v.email, devLink: d.devResetLink });
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
        Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu (có hiệu lực 30 phút).
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
          Gửi liên kết đặt lại mật khẩu
        </Button>
      </form>
      {sent && (
        <div role="status" className="mt-4 rounded-btn bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Nếu <b>{sent.email}</b> đã đăng ký, một email chứa liên kết đặt lại mật khẩu vừa được gửi. Hãy kiểm
          tra hộp thư (kể cả mục thư rác).
          {USE_MOCK && sent.devLink && (
            <p className="mt-1 text-xs">
              (Dữ liệu giả lập, không gửi email thật:{' '}
              <Link className="font-semibold underline" href={sent.devLink}>
                mở liên kết đặt lại mật khẩu
              </Link>
              )
            </p>
          )}
        </div>
      )}
      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name="arrowLeft" size={16} /> Quay lại Đăng nhập
      </Link>
    </AuthLayout>
  );
}
