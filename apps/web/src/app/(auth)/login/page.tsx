'use client';

// Đăng nhập khách hàng (WIREFRAME 2.6)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import GoogleButton from '@/components/account/GoogleButton';
import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import Input, { Checkbox } from '@/components/ui/Input';
import { safeNext } from '@/lib/nav';
import { applyApiErrors, errorMessage, loginSchema } from '@/lib/validators';
import { authApi } from '@/services/auth.api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';

type Values = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState('');
  const f = useForm<Values>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  const done = (r: Awaited<ReturnType<typeof authApi.login>>) => {
    setSession(r.user, r.tokens.accessToken, r.tokens.refreshToken);
    qc.clear();
    toast.success(`Chào mừng ${r.user.fullName} quay trở lại!`);
    router.replace(r.user.roles.includes('admin') && next === '/' ? '/admin' : next);
  };
  const login = useMutation({
    mutationFn: (v: Values) => authApi.login({ email: v.email, password: v.password }),
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
    <div>
      <h1 className="text-2xl font-extrabold tracking-wide">ĐĂNG NHẬP</h1>
      <p className="mt-1 text-sm text-muted">Chào mừng bạn trở lại với Aurelia Living</p>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={f.handleSubmit((v) => {
          setFormError('');
          login.mutate(v);
        })}
      >
        {formError && (
          <p role="alert" className="rounded-btn bg-rose-50 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <Input
          label="Email"
          required
          type="email"
          icon="mail"
          autoComplete="email"
          placeholder="khachhang@aurelia.vn"
          error={err.email?.message}
          {...f.register('email')}
        />
        <Input
          label="Mật khẩu"
          required
          type="password"
          icon="lock"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          error={err.password?.message}
          {...f.register('password')}
        />
        <div className="flex items-center justify-between">
          <Checkbox label="Ghi nhớ đăng nhập" {...f.register('remember')} />
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" block size="lg" loading={login.isPending}>
          Đăng nhập
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        hoặc đăng nhập với
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton label="Đăng nhập với Google" loading={google.isPending} onClick={() => google.mutate()} />
      <p className="mt-6 text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout title="Đăng nhập">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
