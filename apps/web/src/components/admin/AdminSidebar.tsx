'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { useUIStore } from '@/store/uiStore';

interface Item {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  children?: Array<{ href: string; label: string }>;
}

/** 15 mục chuẩn hóa (WIREFRAME 3.0) */
export const adminMenu: Item[] = [
  { href: '/admin', label: 'Tổng quan', icon: 'home', exact: true },
  {
    href: '/admin/products',
    label: 'Sản phẩm',
    icon: 'box',
    children: [
      { href: '/admin/products', label: 'Danh sách sản phẩm' },
      { href: '/admin/products/new', label: 'Thêm sản phẩm' },
    ],
  },
  { href: '/admin/spaces', label: 'Không gian mẫu', icon: 'image' },
  { href: '/admin/categories', label: 'Danh mục', icon: 'folder' },
  { href: '/admin/brands', label: 'Thương hiệu', icon: 'tag' },
  { href: '/admin/attributes', label: 'Thuộc tính', icon: 'list' },
  { href: '/admin/media', label: 'Thư viện media', icon: 'image' },
  { href: '/admin/orders', label: 'Đơn hàng', icon: 'receipt' },
  { href: '/admin/returns', label: 'Đổi trả', icon: 'refresh' },
  { href: '/admin/customers', label: 'Khách hàng', icon: 'users' },
  { href: '/admin/reviews', label: 'Đánh giá', icon: 'star' },
  { href: '/admin/questions', label: 'Hỏi đáp', icon: 'message' },
  { href: '/admin/content', label: 'Nội dung', icon: 'edit' },
  { href: '/admin/models', label: 'Mô hình 3D', icon: 'cube' },
  { href: '/admin/promotions', label: 'Khuyến mãi', icon: 'gift' },
  { href: '/admin/inventory', label: 'Kho hàng', icon: 'boxes' },
  { href: '/admin/reports', label: 'Báo cáo', icon: 'chart' },
  { href: '/admin/notifications', label: 'Gửi thông báo', icon: 'bell' },
  { href: '/admin/roles', label: 'Vai trò & quyền', icon: 'shield' },
  { href: '/admin/activity-logs', label: 'Nhật ký hoạt động', icon: 'list' },
  { href: '/admin/settings', label: 'Cài đặt', icon: 'settings' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const open = useUIStore((s) => s.adminSidebarOpen);
  const setOpen = useUIStore((s) => s.setAdminSidebarOpen);
  const [expanded, setExpanded] = useState<string | null>('/admin/products');

  const isActive = (it: Item) =>
    it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-ink/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-line bg-white transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu quản trị"
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-lg font-extrabold text-white">
            A
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold">AURELIA LIVING</span>
            <span className="block text-[11px] text-muted">Admin Panel</span>
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {adminMenu.map((it) => {
            const active = isActive(it);
            if (it.children) {
              const isOpen = expanded === it.href;
              return (
                <div key={it.href}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : it.href)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium',
                      active ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted/70',
                    )}
                  >
                    <Icon name={it.icon} size={18} />
                    <span className="flex-1 text-left">{it.label}</span>
                    <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={14} />
                  </button>
                  {isOpen && (
                    <div className="ml-9 mt-0.5 space-y-0.5 border-l border-line pl-3">
                      {it.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'block rounded px-2 py-1.5 text-sm',
                            pathname === c.href ? 'font-semibold text-primary' : 'text-muted hover:text-ink',
                          )}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium',
                  active ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted/70',
                )}
              >
                <Icon name={it.icon} size={18} /> {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
