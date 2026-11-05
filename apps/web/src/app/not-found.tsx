'use client';

// Trang 404 (WIREFRAME 7.16)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import StoreLayout from '@/components/layout/StoreLayout';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

export default function NotFound() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <StoreLayout>
      <div className="container-page grid items-center gap-10 py-16 md:grid-cols-2">
        <div>
          <p className="text-8xl font-extrabold leading-none text-primary">404</p>
          <h1 className="mt-4 text-3xl font-extrabold">Ôi! Không tìm thấy trang</h1>
          <p className="mt-2 max-w-md text-muted">
            Trang bạn tìm kiếm có thể đã bị xóa, đổi tên hoặc tạm thời không truy cập được.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
            className="relative mt-5 max-w-md"
            role="search"
          >
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm sản phẩm…"
              aria-label="Tìm kiếm"
              className="field pl-10"
            />
          </form>
          <div className="mt-5 flex gap-3">
            <LinkButton href="/" size="lg">
              Về trang chủ
            </LinkButton>
            <LinkButton href="/products" size="lg" variant="outline">
              Xem sản phẩm
            </LinkButton>
          </div>
          <p className="mt-6 text-sm text-muted">
            Gợi ý:{' '}
            <Link href="/spaces" className="text-primary hover:underline">
              Không gian mẫu
            </Link>{' '}
            ·{' '}
            <Link href="/faq" className="text-primary hover:underline">
              Câu hỏi thường gặp
            </Link>{' '}
            ·{' '}
            <Link href="/contact" className="text-primary hover:underline">
              Liên hệ
            </Link>
          </p>
        </div>
        <div className="relative">
          <img
            src="/mock-img/product?t=armchair&c=D8C3A5&v=4"
            alt=""
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
          <span className="absolute left-4 top-4 rounded-2xl rounded-bl-none bg-white px-4 py-2 text-sm font-semibold shadow-lg">
            Bạn đi lạc rồi sao? 🛋️
          </span>
        </div>
      </div>
    </StoreLayout>
  );
}
