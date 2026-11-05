'use client';

// Header điều hướng chính của storefront (WIREFRAME 1.1): 2 trạng thái đăng nhập / chưa đăng nhập,
// badge giỏ hàng + yêu thích, dropdown thông báo (7.10).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys, useCartQuery, useUnreadCount, useWishlist } from '@/hooks/useCart';
import { useCategories } from '@/hooks/useProducts';
import { cn } from '@/lib/cn';
import { formatRelativeTime, initials } from '@/lib/format';
import { notificationApi } from '@/services/content.api';
import Logo from './Logo';

const nav = [
  { href: '/', label: 'Trang chủ', match: (p: string) => p === '/' },
  {
    href: '/products',
    label: 'Sản phẩm',
    match: (p: string) => p.startsWith('/products') || p.startsWith('/search'),
  },
  { href: '/spaces', label: 'Không gian mẫu', match: (p: string) => p.startsWith('/spaces') },
  { href: '/about', label: 'Về chúng tôi', match: (p: string) => p.startsWith('/about') },
];

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}

function SearchBox() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [value, setValue] = useState(pathname.startsWith('/search') ? (sp.get('q') ?? '') : '');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };
  return (
    <form onSubmit={submit} role="search" className="relative w-full">
      <Icon
        name="search"
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm kiếm sản phẩm, không gian mẫu…"
        aria-label="Tìm kiếm"
        className="field rounded-full bg-surface-muted/50 pl-10 pr-9"
      />
      {value && (
        <button
          type="button"
          aria-label="Xóa từ khóa"
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </form>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const qc = useQueryClient();
  const unread = useUnreadCount();
  const list = useQuery({
    queryKey: [...queryKeys.notifications, 'latest'],
    queryFn: () => notificationApi.list({ pageSize: 5 }),
    enabled: open,
  });
  const count = unread.data?.count ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 hover:bg-surface-muted"
      >
        <Icon name="bell" />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-card border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-bold">Thông báo</span>
            {count > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={async () => {
                  await notificationApi.markAllRead();
                  qc.invalidateQueries({ queryKey: queryKeys.notifications });
                }}
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {list.isLoading && <li className="px-4 py-6 text-center text-sm text-muted">Đang tải…</li>}
            {list.data?.items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">Chưa có thông báo nào.</li>
            )}
            {list.data?.items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.data.link ?? '/account/notifications'}
                  onClick={async () => {
                    setOpen(false);
                    if (!n.readAt) {
                      await notificationApi.markRead(n.id);
                      qc.invalidateQueries({ queryKey: queryKeys.notifications });
                    }
                  }}
                  className={cn(
                    'block border-b border-line/60 px-4 py-3 hover:bg-surface-muted/60',
                    !n.readAt && 'bg-primary-soft/50',
                  )}
                >
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted">{n.data.content}</p>
                  <p className="mt-1 text-[11px] text-muted">{formatRelativeTime(n.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/account/notifications"
            onClick={() => setOpen(false)}
            className="block py-3 text-center text-sm font-semibold text-primary hover:bg-surface-muted"
          >
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-btn px-2 py-2 text-sm font-medium hover:bg-surface-muted"
      >
        <Icon name="user" />
        <span className="hidden sm:inline">Đăng nhập</span>
      </Link>
    );
  }
  const items = [
    { href: '/account/profile', label: 'Thông tin cá nhân' },
    { href: '/account/orders', label: 'Đơn hàng của tôi' },
    { href: '/wishlist', label: 'Sản phẩm yêu thích' },
    { href: '/account/coupons', label: 'Mã giảm giá của tôi' },
  ];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {initials(user.fullName)}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm font-medium lg:block">{user.fullName}</span>
        <Icon name="chevronDown" size={16} className="hidden lg:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-card border border-line bg-white py-1 shadow-xl">
          <div className="border-b border-line px-4 py-2.5">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          {user.roles.includes('admin') && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-muted"
            >
              Vào trang quản trị
            </Link>
          )}
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-surface-muted"
            >
              {i.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push('/');
            }}
            className="block w-full border-t border-line px-4 py-2 text-left text-sm text-danger hover:bg-surface-muted"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const cart = useCartQuery();
  const wishlist = useWishlist();
  const categories = useCategories();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useClickOutside(() => setCatOpen(false));
  const cartCount = cart.data?.itemCount ?? 0;

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-page flex h-[68px] items-center gap-3 lg:gap-6">
        <button
          type="button"
          className="rounded p-2 hover:bg-surface-muted lg:hidden"
          aria-label="Mở menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} />
        </button>
        <Logo />
        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Menu chính">
          {nav.slice(0, 3).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'relative px-3 py-2 text-sm font-medium',
                n.match(pathname)
                  ? 'text-primary after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-primary'
                  : 'text-ink hover:text-primary',
              )}
            >
              {n.label}
            </Link>
          ))}
          <div className="relative" ref={catRef}>
            <button
              type="button"
              onClick={() => setCatOpen((o) => !o)}
              aria-expanded={catOpen}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium hover:text-primary"
            >
              Danh mục <Icon name="chevronDown" size={14} />
            </button>
            {catOpen && (
              <div className="absolute left-0 top-full z-40 mt-3 grid w-[520px] grid-cols-2 gap-x-6 gap-y-3 rounded-card border border-line bg-white p-5 shadow-xl">
                {categories.data?.map((c) => (
                  <div key={c.id}>
                    <Link
                      href={`/products?category=${c.slug}`}
                      onClick={() => setCatOpen(false)}
                      className="text-sm font-bold hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    <ul className="mt-1 space-y-0.5">
                      {c.children.map((ch) => (
                        <li key={ch.id}>
                          <Link
                            href={`/products?category=${ch.slug}`}
                            onClick={() => setCatOpen(false)}
                            className="text-sm text-muted hover:text-primary"
                          >
                            {ch.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          {nav.slice(3).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'relative px-3 py-2 text-sm font-medium',
                n.match(pathname) ? 'text-primary' : 'hover:text-primary',
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mx-auto hidden max-w-md flex-1 md:block">
          <Suspense fallback={<div className="field h-10 rounded-full" />}>
            <SearchBox />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-0.5 md:ml-0">
          <Link
            href="/wishlist"
            aria-label="Yêu thích"
            className="relative rounded-full p-2 hover:bg-surface-muted"
          >
            <Icon name="heart" />
            {wishlist.count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {wishlist.count}
              </span>
            )}
          </Link>
          {user && <NotificationBell />}
          <Link
            href="/cart"
            aria-label="Giỏ hàng"
            className="relative rounded-full p-2 hover:bg-surface-muted"
          >
            <Icon name="cart" />
            {cartCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <AccountMenu />
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-line bg-white px-4 py-3 lg:hidden">
          <div className="mb-3 md:hidden">
            <Suspense fallback={null}>
              <SearchBox />
            </Suspense>
          </div>
          <nav className="flex flex-col" aria-label="Menu di động">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'rounded px-2 py-2.5 text-sm font-medium',
                  n.match(pathname) ? 'bg-surface-muted text-primary' : '',
                )}
              >
                {n.label}
              </Link>
            ))}
            {categories.data?.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="rounded px-2 py-2 text-sm text-muted"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
