'use client';

// Xác thực email (UC-AUTH-07): mở từ liên kết trong email (?token=…), gọi API xác thực một lần khi vào trang
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import AuthLayout from '@/components/layout/AuthLayout';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { errorMessage } from '@/lib/validators';
import { authApi } from '@/services/auth.api';

function Result() {
  const token = useSearchParams().get('token') ?? '';
  const qc = useQueryClient();
  const started = useRef(false);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'Liên kết xác thực không hợp lệ.');

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authApi
      .verifyEmail(token)
      .then(() => {
        setState('ok');
        qc.invalidateQueries({ queryKey: ['me'] });
      })
      .catch((e) => {
        setState('error');
        setMessage(errorMessage(e));
      });
  }, [token, qc]);

  if (state === 'loading') return <p className="text-sm text-muted">Đang xác thực email…</p>;
  if (state === 'ok') {
    return (
      <div role="status">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Icon name="check" size={28} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-wide">XÁC THỰC THÀNH CÔNG</h1>
        <p className="mt-1 text-sm text-muted">
          Email của bạn đã được xác thực. Bạn có thể đánh giá sản phẩm đã mua.
        </p>
        <LinkButton href="/account/orders" className="mt-6" block>
          Xem đơn hàng của tôi
        </LinkButton>
      </div>
    );
  }
  return (
    <div role="alert">
      <h1 className="text-2xl font-extrabold tracking-wide">XÁC THỰC KHÔNG THÀNH CÔNG</h1>
      <p className="mt-1 text-sm text-danger">{message}</p>
      <p className="mt-3 text-sm text-muted">
        Hãy đăng nhập và chọn “Gửi lại email xác thực” ở trang{' '}
        <Link href="/account/profile" className="font-semibold text-primary hover:underline">
          Tài khoản
        </Link>
        .
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Xác thực email">
      <Suspense fallback={null}>
        <Result />
      </Suspense>
    </AuthLayout>
  );
}
