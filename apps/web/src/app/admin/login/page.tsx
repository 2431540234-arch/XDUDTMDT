'use client';

// Đăng nhập quản trị (WIREFRAME 7.17) – chỉ tài khoản role 'admin' (Doanh nghiệp)
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Checkbox } from '@/components/ui/Input';
import { isAdmin, useAuthStore } from '@/store/authStore';
import { applyApiErrors, errorMessage, loginSchema } from '@/lib/validators';
import { authApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

type Values = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, hydrated, setSession, clear } = useAuthStore();
  const [formError, setFormError] = useState('');
  const f = useForm<Values>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  useEffect(() => {
    if (hydrated && isAdmin(user)) router.replace('/admin');
  }, [hydrated, user, router]);

  const login = useMutation({
    mutationFn: (v: Values) => authApi.login({ email: v.email, password: v.password, adminOnly: true }),
    onSuccess: (r) => {
      clear();
      setSession(r.user, r.tokens.accessToken, r.tokens.refreshToken);
      qc.clear();
      toast.success('Đăng nhập quản trị thành công.');
      router.replace('/admin');
    },
    onError: (e) => {
      if (!applyApiErrors(e, f.setError)) setFormError(errorMessage(e));
    },
  });
  const err = f.formState.errors;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between p-10 text-white lg:flex"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(43,30,22,0.92), rgba(43,30,22,0.55)), url(/mock-img/banner?n=5&s=Luxury)',
          backgroundSize: 'cover',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-xl font-extrabold">
            A
          </span>
          <span className="font-extrabold tracking-wide">AURELIA LIVING</span>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold">Hệ thống quản trị Aurelia Living</h2>
          <p className="mt-3 max-w-md text-white/80">
            Quản lý sản phẩm, mô hình 3D, không gian mẫu, đơn hàng và báo cáo thu chi tại một nơi.
          </p>
        </div>
        <p className="text-xs text-white/60">© 2026 Aurelia Living</p>
      </div>
      <div className="flex items-center justify-center bg-bg p-6">
        <div className="card w-full max-w-md p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-primary">
            <Icon name="shield" size={28} />
          </div>
          <h1 className="text-center text-2xl font-extrabold">Đăng nhập quản trị</h1>
          <p className="mt-1 text-center text-sm text-muted">Dành cho tài khoản Doanh nghiệp</p>
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
              label="Email / Tên đăng nhập"
              required
              icon="user"
              autoComplete="username"
              placeholder="admin@aurelia.vn"
              error={err.email?.message}
              {...f.register('email')}
            />
            <Input
              label="Mật khẩu"
              required
              type="password"
              icon="lock"
              autoComplete="current-password"
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
          <p className="mt-5 text-center text-xs text-muted">
            Tài khoản được bảo vệ bằng xác thực hai lớp (OTP) khi triển khai thật.
          </p>
          <p className="mt-3 text-center text-sm">
            <Link href="/" className="text-primary hover:underline">
              ← Về website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
