'use client';

// Về chúng tôi (WIREFRAME 7.11): nội dung lấy từ trang tĩnh slug "about" (Admin → Nội dung → Trang tĩnh), không còn số liệu/đội ngũ viết cứng
import { useQuery } from '@tanstack/react-query';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { LinkButton } from '@/components/ui/Button';
import RichText from '@/components/ui/RichText';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ApiClientError } from '@/services/api-client';
import { contentApi } from '@/services/content.api';

export default function AboutPage() {
  const q = useQuery({ queryKey: ['page', 'about'], queryFn: () => contentApi.page('about') });
  return (
    <div className="container-page py-6">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Về chúng tôi' }]} />
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{q.data?.title ?? 'Về chúng tôi'}</h1>
        <div className="mt-6">
          {q.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : q.isError ? (
            q.error instanceof ApiClientError && q.error.status === 404 ? (
              <EmptyState
                icon="info"
                title="Nội dung đang được cập nhật"
                description="Trang giới thiệu chưa có nội dung."
                action={<LinkButton href="/">Về trang chủ</LinkButton>}
              />
            ) : (
              <ErrorState onRetry={() => q.refetch()} />
            )
          ) : q.data?.content ? (
            <RichText content={q.data.content} />
          ) : (
            <EmptyState icon="info" title="Nội dung đang được cập nhật" />
          )}
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/contact" size="lg">
            Liên hệ
          </LinkButton>
          <LinkButton href="/spaces" size="lg" variant="outline">
            Xem không gian mẫu
          </LinkButton>
        </div>
      </article>
    </div>
  );
}
