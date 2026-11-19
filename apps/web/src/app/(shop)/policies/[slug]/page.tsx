// Chính sách – một template cho mọi /policies/:slug (WIREFRAME 7.14); nội dung viết cứng ở src/content/static-pages.ts
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/ui/Breadcrumb';
import RichText from '@/components/ui/RichText';
import { pageBySlug, policyPages, STATIC_PAGES } from '@/content/static-pages';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

export function generateStaticParams() {
  return STATIC_PAGES.filter((p) => p.slug !== 'about').map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = pageBySlug(params.slug);
  return page ? { title: page.metaTitle, description: page.metaDescription } : {};
}

export default function PolicyPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const page = pageBySlug(slug);
  if (!page || slug === 'about') notFound();
  const list = policyPages();
  const isReturn = slug === 'chinh-sach-doi-tra';
  const highlights = isReturn
    ? [
        ['7 ngày', 'Đổi trả kể từ ngày nhận hàng'],
        ['Miễn phí', 'Lấy hàng tận nơi'],
        ['3–5 ngày', 'Hoàn tiền sau khi kiểm tra'],
      ]
    : [
        ['Minh bạch', 'Điều khoản rõ ràng'],
        ['An toàn', 'Bảo vệ quyền lợi khách hàng'],
        ['Hỗ trợ', 'Hotline 0123 456 789'],
      ];

  return (
    <div className="container-page py-6">
      <Breadcrumb
        items={[{ label: 'Trang chủ', href: '/' }, { label: 'Chính sách' }, { label: page.title }]}
      />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit p-3">
          <nav aria-label="Danh sách chính sách" className="flex gap-1 overflow-x-auto lg:flex-col">
            {list.map((p) => (
              <Link
                key={p.slug}
                href={`/policies/${p.slug}`}
                aria-current={p.slug === slug ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-btn px-3 py-2.5 text-sm font-medium',
                  p.slug === slug ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted/60',
                )}
              >
                {p.title}
              </Link>
            ))}
          </nav>
        </aside>
        <article className="card p-6 sm:p-8">
          <h1 className="text-3xl font-extrabold">{page.title}</h1>
          <p className="mt-1 text-sm text-muted">Cập nhật lần cuối: {formatDate(page.updatedAt)}</p>
          <div className="my-6 grid gap-3 rounded-card bg-surface-muted p-4 sm:grid-cols-3">
            {highlights.map(([t, d]) => (
              <div key={t} className="text-center">
                <p className="text-lg font-extrabold text-primary">{t}</p>
                <p className="text-xs text-muted">{d}</p>
              </div>
            ))}
          </div>
          <RichText content={page.content} />
        </article>
      </div>
    </div>
  );
}
