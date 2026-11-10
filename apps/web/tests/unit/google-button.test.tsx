import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleSection, googleLoginEnabled } from '@/components/account/GoogleButton';

// Đăng nhập Google chưa làm ở BE: nút chỉ hiện khi NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true
describe('GoogleSection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('mặc định (không đặt biến) ẩn cả nút lẫn dấu phân cách', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED', '');
    const { container } = render(
      <GoogleSection divider="hoặc" label="Đăng nhập với Google" onClick={() => {}} />,
    );
    expect(googleLoginEnabled()).toBe(false);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('giá trị khác "true" (ví dụ "1", "false") vẫn ẩn', () => {
    for (const v of ['false', '1', 'TRUE']) {
      vi.stubEnv('NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED', v);
      expect(googleLoginEnabled()).toBe(false);
    }
  });

  it('đặt NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true ⇒ hiện nút và dấu phân cách', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED', 'true');
    render(<GoogleSection divider="hoặc" label="Đăng nhập với Google" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /Đăng nhập với Google/ })).toBeVisible();
    expect(screen.getByText('hoặc')).toBeVisible();
  });
});
