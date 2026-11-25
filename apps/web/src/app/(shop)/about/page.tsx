// Về chúng tôi (WIREFRAME 7.11): nội dung viết cứng ở src/content/static-pages.ts (slug "about")
import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { LinkButton } from '@/components/ui/Button';
import RichText from '@/components/ui/RichText';
import { pageBySlug } from '@/content/static-pages';

const page = pageBySlug('about')!;

export const metadata: Metadata = { title: page.metaTitle, description: page.metaDescription };

export default function AboutPage() {
  return (
    <div className="container-page py-6">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Về chúng tôi' }]} />
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{page.title}</h1>
        <div className="mt-6">
          <RichText content={page.content} />
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/spaces" size="lg" variant="outline">
            Xem không gian mẫu
          </LinkButton>
        </div>
      </article>
    </div>
  );
}
