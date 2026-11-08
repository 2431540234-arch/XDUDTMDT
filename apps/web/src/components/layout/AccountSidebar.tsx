'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon, { type IconName } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const items: Array<{ href: string; label: string; icon: IconName; match?: (p: string) => boolean }> = [
  { href: '/account/profile', label: 'Thông tin cá nhân', icon: 'user' },
  { href: '/account/profile#dia-chi', label: 'Địa chỉ của tôi', icon: 'pin', match: () => false },
  {
    href: '/account/orders',
    label: 'Đơn hàng của tôi',
    icon: 'receipt',
    match: (p) => p.startsWith('/account/orders'),
  },
  {
    href: '/account/returns',
    label: 'Đổi trả & hoàn tiền',
    icon: 'refresh',
    match: (p) => p.startsWith('/account/returns'),
  },
  { href: '/wishlist', label: 'Sản phẩm yêu thích', icon: 'heart' },
  { href: '/account/coupons', label: 'Mã giảm giá của tôi', icon: 'tag' },
  { href: '/account/reviews', label: 'Đánh giá của tôi', icon: 'star' },
  { href: '/account/notifications', label: 'Thông báo', icon: 'bell' },
  { href: '/account/password', label: 'Đổi mật khẩu', icon: 'lock' },
  { href: '/account/sessions', label: 'Phiên đăng nhập', icon: 'shield' },
];

/** Sidebar tài khoản – 11 mục (WIREFRAME 1.7 bản đầy đủ) */
export default function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  return (
    <aside className="card h-fit w-full shrink-0 p-4 lg:w-[270px]" aria-label="Menu tài khoản">
      <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
          {user ? initials(user.fullName) : '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold">{user?.fullName}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <Link href="/account/profile" className="text-xs font-medium text-primary hover:underline">
            Chỉnh sửa hồ sơ
          </Link>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((it) => {
          const active = it.match ? it.match(pathname) : pathname === it.href;
          return (
            <Link
              key={it.label}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 whitespace-nowrap rounded-btn px-3 py-2.5 text-sm font-medium transition',
                active ? 'bg-surface-muted text-primary' : 'text-ink hover:bg-surface-muted/70',
              )}
            >
              <Icon name={it.icon} size={18} /> {it.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push('/');
          }}
          className="flex items-center gap-3 whitespace-nowrap rounded-btn px-3 py-2.5 text-left text-sm font-medium text-danger hover:bg-surface-muted/70"
        >
          <Icon name="logout" size={18} /> Đăng xuất
        </button>
      </nav>
    </aside>
  );
}
