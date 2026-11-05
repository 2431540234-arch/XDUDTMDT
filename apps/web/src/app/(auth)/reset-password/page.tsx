'use client';

// Đặt lại mật khẩu (WIREFRAME 7.4): 6 ô OTP tự nhảy, đếm ngược gửi lại, thanh độ mạnh mật khẩu
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { maskEmail } from '@/lib/format';
import { errorMessage, passwordStrength } from '@/lib/validators';
import { authApi } from '@/services/auth.api';
import { toast } from '@/store/uiStore';

const RESEND_SECONDS = 45;

function Form() {
  const router = useRouter();
  const email = useSearchParams().get('email') ?? '';
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [left, setLeft] = useState(RESEND_SECONDS);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const strength = passwordStrength(pw);
  const reset = useMutation({
    mutationFn: () => authApi.resetPassword({ email, otp: otp.join(''), password: pw }),
    onSuccess: () => {
      toast.success('Đặt lại mật khẩu thành công. Vui lòng đăng nhập.');
      router.replace('/login');
    },
    onError: (e) => setErrs({ form: errorMessage(e) }),
  });
  const resend = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => {
      setLeft(RESEND_SECONDS);
      toast.success('Đã gửi lại mã xác thực.');
    },
  });

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length > 1) {
      // dán nhiều số
      const next = [...otp];
      d.slice(0, 6 - i)
        .split('')
        .forEach((c, k) => (next[i + k] = c));
      setOtp(next);
      refs.current[Math.min(i + d.length, 5)]?.focus();
      return;
    }
    const next = [...otp];
    next[i] = d;
    setOtp(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (otp.join('').length < 6) x.otp = 'Vui lòng nhập đủ 6 số của mã OTP.';
    if (pw.length < 8) x.password = 'Mật khẩu tối thiểu 8 ký tự.';
    if (confirm !== pw) x.confirm = 'Mật khẩu xác nhận không khớp.';
    setErrs(x);
    if (!Object.keys(x).length) reset.mutate();
  };

  if (!email) {
    return (
      <div>
        <p className="text-sm text-muted">
          Thiếu thông tin email. Vui lòng bắt đầu lại từ bước “Quên mật khẩu”.
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
      <p className="mt-1 text-sm text-muted">
        Mã OTP đã được gửi tới <b className="text-ink">{maskEmail(email)}</b>
      </p>
      <p className="mt-1 text-xs text-muted">
        (Dữ liệu giả lập: mã OTP luôn là <b>123456</b>)
      </p>
      <form className="mt-6 space-y-4" noValidate onSubmit={submit}>
        {errs.form && (
          <p role="alert" className="rounded-btn bg-rose-50 px-3 py-2 text-sm text-danger">
            {errs.form}
          </p>
        )}
        <div>
          <div className="flex justify-between gap-2" role="group" aria-label="Mã OTP 6 số">
            {otp.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={d}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={`Số OTP thứ ${i + 1}`}
                maxLength={6}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && i > 0 && refs.current[i - 1]?.focus()}
                className={cn(
                  'field !h-12 !w-12 !px-0 text-center text-lg font-bold',
                  errs.otp && 'field-error',
                )}
              />
            ))}
          </div>
          {errs.otp && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errs.otp}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Không nhận được mã?{' '}
            {left > 0 ? (
              <span>Gửi lại (00:{String(left).padStart(2, '0')})</span>
            ) : (
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => resend.mutate()}
              >
                Gửi lại
              </button>
            )}
          </p>
        </div>
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
