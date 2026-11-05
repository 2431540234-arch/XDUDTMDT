'use client';

import type { ReactNode } from 'react';
import { PageSkeleton } from '@/components/ui/States';
import { useRequireCustomer } from '@/hooks/useAuth';
import AccountSidebar from './AccountSidebar';
import Footer from './Footer';
import Header from './Header';

/** Layout khu tài khoản: yêu cầu đăng nhập (route guard) + AccountSidebar bên trái */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const { ready } = useRequireCustomer();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container-page flex flex-col gap-6 py-8 lg:flex-row">
          {ready ? (
            <>
              <AccountSidebar />
              <div className="min-w-0 flex-1">{children}</div>
            </>
          ) : (
            <div className="flex-1">
              <PageSkeleton />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
