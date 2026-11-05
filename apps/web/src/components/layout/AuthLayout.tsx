import type { ReactNode } from 'react';
import Footer from './Footer';
import Icon from '@/components/ui/Icon';
import Logo from './Logo';

const highlights = [
  { icon: 'cube', text: 'Trải nghiệm 3D chân thực' },
  { icon: 'grid', text: 'Đa dạng phong cách' },
  { icon: 'truck', text: 'Giao hàng toàn quốc' },
] as const;

/** Layout xác thực 2 cột: trái ảnh + 3 điểm nổi bật, phải form (WIREFRAME 2.6, 2.7, 7.3, 7.4) */
export default function AuthLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-line bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <span className="text-sm font-semibold text-muted">{title}</span>
        </div>
      </header>
      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-line bg-white shadow-card lg:grid-cols-2">
          <div
            className="relative hidden min-h-[560px] flex-col justify-end p-10 text-white lg:flex"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(43,30,22,0.15), rgba(43,30,22,0.85)), url(/mock-img/banner?n=3&s=Luxury)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <h2 className="text-2xl font-extrabold tracking-wide">AURELIA LIVING</h2>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Nội thất hiện đại kết hợp trải nghiệm sản phẩm 3D cho không gian sống của bạn.
            </p>
            <ul className="mt-6 space-y-3">
              {highlights.map((h) => (
                <li key={h.text} className="flex items-center gap-3 text-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Icon name={h.icon} size={18} />
                  </span>
                  {h.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6 sm:p-10">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
