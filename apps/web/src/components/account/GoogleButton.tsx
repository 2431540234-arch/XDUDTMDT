'use client';

import Button from '@/components/ui/Button';

/**
 * Đăng nhập Google CHƯA được làm ở BE (POST /auth/google luôn 503 khi chưa cấu hình OAuth). Nút và dấu phân cách chỉ hiện khi
 * đặt NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true (đọc trực tiếp để Next nhúng giá trị lúc build).
 */
export function googleLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true';
}

/** Dấu phân cách + nút Google; không render gì khi đăng nhập Google chưa bật */
export function GoogleSection({
  divider,
  label,
  loading,
  onClick,
}: {
  divider: string;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  if (!googleLoginEnabled()) return null;
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        {divider}
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton label={label} loading={loading} onClick={onClick} />
    </>
  );
}

/** Nút Google (giả lập: BE chưa có đăng nhập Google) */
export default function GoogleButton({
  label,
  onClick,
  loading,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      block
      loading={loading}
      onClick={onClick}
      className="!border-line !text-ink hover:!bg-surface-muted"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path
          fill="#EA4335"
          d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
        />
        <path
          fill="#FBBC05"
          d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
        />
      </svg>
      {label}
    </Button>
  );
}
