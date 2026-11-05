'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageSkeleton } from '@/components/ui/States';
import { useRequireAdmin } from '@/hooks/useAuth';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';

/** Layout Admin Panel: guard role 'admin' (Doanh nghiệp) + sidebar 15 mục + topbar. Trang /admin/login không dùng layout này. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready } = useRequireAdmin();
  if (pathname === '/admin/login') return <>{children}</>;
  return (
    <div className="min-h-screen bg-bg">
      <AdminSidebar />
      <div className="lg:pl-[250px]">
        <AdminTopbar />
        <main className="p-4 lg:p-6">{ready ? children : <PageSkeleton />}</main>
      </div>
    </div>
  );
}
