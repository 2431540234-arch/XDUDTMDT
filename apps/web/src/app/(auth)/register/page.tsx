'use client';

// Đăng ký (WIREFRAME 2.7)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import GoogleButton from '@/components/account/GoogleButton';
import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import Input, { Checkbox } from '@/components/ui/Input';
import { applyApiErrors, errorMessage, registerSchema } from '@/lib/validators';
import { authApi } from '@/services/auth.api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';

type Values = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState('');
  const f = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirm: '', agree: false },
  });
  const done = (r: Awaited<ReturnType<typeof authApi.register>>) => {
    setSession(r.user, r.tokens.accessToken, r.tokens.refreshToken);
    qc.clear();
    toast.success('Đăng ký thành công! Chào mừng bạn đến với Aurelia Living.');
    router.replace('/');
  };
  const reg = useMutation({
    mutationFn: (v: Values) =>
      authApi.register({
        fullName: v.fullName,
        email: v.email,
        phone: v.phone || undefined,
        password: v.password,
        confirmPassword: v.confirm,
      }),
    onSuccess: done,
    onError: (e) => {
      if (!applyApiErrors(e, f.setError)) setFormError(errorMessage(e));
    },
  });
  const google = useMutation({
    mutationFn: authApi.googleLogin,
    onSuccess: done,
    onError: (e) => setFormError(errorMessage(e)),
  });
  const err = f.formState.errors;

  return (
    <AuthLayout title="Đăng ký">
      <h1 className="text-2xl font-extrabold tracking-wide">ĐĂNG KÝ</h1>
      <p className="mt-1 text-sm text-muted">Tạo tài khoản mới để khám phá thế giới nội thất 3D</p>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={f.handleSubmit((v) => {
          setFormError('');
          reg.mutate(v);
        })}
      >
        {formError && (
          <p role="alert" className="rounded-btn bg-rose-50 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <Input
          label="Họ và tên"
          required
          icon="user"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          error={err.fullName?.message}
          {...f.register('fullName')}
        />
        <Input
          label="Email"
          required
          type="email"
          icon="mail"
          autoComplete="email"
          placeholder="email@example.com"
          error={err.email?.message}
          {...f.register('email')}
        />
        <Input
          label="Số điện thoại (tuỳ chọn)"
          inputMode="tel"
          icon="phone"
          autoComplete="tel"
          placeholder="0901234567"
          error={err.phone?.message}
          {...f.register('phone')}
        />
        <Input
          label="Mật khẩu"
          required
          type="password"
          icon="lock"
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số"
          error={err.password?.message}
          {...f.register('password')}
        />
        <Input
          label="Xác nhận mật khẩu"
          required
          type="password"
          icon="lock"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          error={err.confirm?.message}
          {...f.register('confirm')}
        />
        <Checkbox
          error={err.agree?.message}
          label={
            <>
              Tôi đồng ý với{' '}
              <Link href="/policies/dieu-khoan-su-dung" className="text-primary underline">
                Điều khoản sử dụng
              </Link>{' '}
              và{' '}
              <Link href="/policies/chinh-sach-bao-mat" className="text-primary underline">
                Chính sách bảo mật
              </Link>
            </>
          }
          {...f.register('agree')}
        />
        <Button type="submit" block size="lg" loading={reg.isPending}>
          Đăng ký
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        hoặc
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton label="Đăng ký với Google" loading={google.isPending} onClick={() => google.mutate()} />
      <p className="mt-6 text-center text-sm text-muted">
        Đã có tài khoản?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Đăng nhập ngay
        </Link>
      </p>
    </AuthLayout>
  );
}
