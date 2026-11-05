'use client';

// Chính sách – một template cho mọi /policies/:slug (WIREFRAME 7.14); nội dung lấy từ Admin → Nội dung → Trang tĩnh
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { LinkButton } from '@/components/ui/Button';
import RichText from '@/components/ui/RichText';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { ApiClientError } from '@/services/api-client';
import { contentApi } from '@/services/content.api';

export default function PolicyPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = useQuery({ queryKey: ['page', slug], queryFn: () => contentApi.page(slug) });
  const list = useQuery({ queryKey: ['policies'], queryFn: contentApi.policies });
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
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Chính sách' },
          { label: page.data?.title ?? '…' },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit p-3">
          <nav aria-label="Danh sách chính sách" className="flex gap-1 overflow-x-auto lg:flex-col">
            {list.data?.map((p) => (
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
          {page.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : page.isError ? (
            page.error instanceof ApiClientError && page.error.status === 404 ? (
              <EmptyState
                icon="info"
                title="Không tìm thấy trang"
                action={<LinkButton href="/">Về trang chủ</LinkButton>}
              />
            ) : (
              <ErrorState onRetry={() => page.refetch()} />
            )
          ) : (
            page.data && (
              <>
                <h1 className="text-3xl font-extrabold">{page.data.title}</h1>
                <p className="mt-1 text-sm text-muted">
                  Cập nhật lần cuối: {formatDate(page.data.updatedAt)}
                </p>
                <div className="my-6 grid gap-3 rounded-card bg-surface-muted p-4 sm:grid-cols-3">
                  {highlights.map(([t, d]) => (
                    <div key={t} className="text-center">
                      <p className="text-lg font-extrabold text-primary">{t}</p>
                      <p className="text-xs text-muted">{d}</p>
                    </div>
                  ))}
                </div>
                <RichText content={page.data.content ?? ''} />
              </>
            )
          )}
        </article>
      </div>
    </div>
  );
}
