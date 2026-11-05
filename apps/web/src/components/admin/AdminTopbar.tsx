'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime, initials } from '@/lib/format';
import { adminApi } from '@/services/admin.api';
import { useUIStore } from '@/store/uiStore';

function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: React.ReactNode;
  align?: 'right' | 'left';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={`absolute top-full z-40 mt-2 w-72 overflow-hidden rounded-card border border-line bg-white shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function AdminTopbar() {
  const setSidebar = useUIStore((s) => s.setAdminSidebarOpen);
  const { user, logout } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const search = useQuery({
    queryKey: ['admin-search', q],
    queryFn: () => adminApi.search(q),
    enabled: q.trim().length >= 2,
  });
  const notes = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: adminApi.notifications,
    staleTime: 30_000,
  });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
      <button
        type="button"
        aria-label="Mở menu"
        onClick={() => setSidebar(true)}
        className="rounded p-2 hover:bg-surface-muted lg:hidden"
      >
        <Icon name="menu" />
      </button>
      <div className="relative max-w-xl flex-1">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm kiếm sản phẩm, đơn hàng, khách hàng…"
          aria-label="Tìm kiếm"
          className="field pl-10"
        />
        {q.trim().length >= 2 && (
          <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-card border border-line bg-white py-1 shadow-xl">
            {(search.data ?? []).map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  onClick={() => setQ('')}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surface-muted"
                >
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {r.type === 'product' ? 'SP' : r.type === 'order' ? 'Đơn' : 'KH'}
                  </span>
                  {r.label}
                </Link>
              </li>
            ))}
            {search.data?.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">Không tìm thấy kết quả.</li>
            )}
          </ul>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Dropdown
          trigger={(_o, toggle) => (
            <button
              type="button"
              aria-label="Thông báo"
              onClick={toggle}
              className="relative rounded-full p-2 hover:bg-surface-muted"
            >
              <Icon name="bell" />
              {(notes.data?.length ?? 0) > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {notes.data?.length}
                </span>
              )}
            </button>
          )}
        >
          <p className="border-b border-line px-4 py-3 font-bold">Thông báo</p>
          <ul className="max-h-72 overflow-y-auto">
            {(notes.data ?? []).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link}
                  className="block border-b border-line/60 px-4 py-2.5 text-sm hover:bg-surface-muted"
                >
                  {n.text}
                  <span className="block text-[11px] text-muted">{formatRelativeTime(n.createdAt)}</span>
                </Link>
              </li>
            ))}
            {notes.data?.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">Không có thông báo mới.</li>
            )}
          </ul>
        </Dropdown>
        <Dropdown
          trigger={(_o, toggle) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-muted"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {user ? initials(user.fullName) : 'A'}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-sm font-semibold">{user?.fullName}</span>
                <span className="block text-[11px] text-muted">Doanh nghiệp (Admin)</span>
              </span>
              <Icon name="chevronDown" size={14} />
            </button>
          )}
        >
          <Link href="/" className="block px-4 py-2.5 text-sm hover:bg-surface-muted">
            Xem website
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push('/admin/login');
            }}
            className="block w-full border-t border-line px-4 py-2.5 text-left text-sm text-danger hover:bg-surface-muted"
          >
            Đăng xuất
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
