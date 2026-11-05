'use client';

// Tab Mô tả / Thông số / Đánh giá / Hỏi đáp trên trang chi tiết sản phẩm
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import ReviewCard from '@/components/account/ReviewCard';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import StarRating from '@/components/ui/StarRating';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { productApi } from '@/services/product.api';
import { toast } from '@/store/uiStore';
import type { ProductDetail } from '@/types/api';

type TabKey = 'desc' | 'specs' | 'reviews' | 'qa';

function Reviews({ p }: { p: ProductDetail }) {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(0);
  const q = useQuery({
    queryKey: ['reviews', p.slug, page, rating],
    queryFn: () => productApi.reviews(p.slug, { page, rating: rating || undefined }),
  });
  const total = p.ratingCount || 1;
  return (
    <div>
      <div className="mb-6 grid gap-6 rounded-card bg-surface-muted/60 p-5 sm:grid-cols-[180px_1fr]">
        <div className="text-center">
          <p className="text-5xl font-extrabold text-primary">{p.ratingAvg.toFixed(1)}</p>
          <StarRating value={p.ratingAvg} size={18} className="mt-1" />
          <p className="mt-1 text-sm text-muted">{p.ratingCount} đánh giá</p>
        </div>
        <div className="space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setRating(rating === n ? 0 : n);
                setPage(1);
              }}
              className="flex w-full items-center gap-3 text-sm"
              aria-pressed={rating === n}
            >
              <span className="w-10 text-left font-medium">{n} sao</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-star"
                  style={{ width: `${(p.ratingBreakdown[n] / total) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right text-muted">{p.ratingBreakdown[n]}</span>
            </button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data?.items.length ? (
        <div className="space-y-4">
          {q.data.items.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          <Pagination page={q.data.meta.page} totalPages={q.data.meta.totalPages} onChange={setPage} />
        </div>
      ) : (
        <EmptyState
          icon="star"
          title="Chưa có đánh giá"
          description={
            rating
              ? 'Không có đánh giá nào ở mức sao này.'
              : 'Hãy là người đầu tiên đánh giá sản phẩm này sau khi mua hàng.'
          }
        />
      )}
    </div>
  );
}

function Questions({ p }: { p: ProductDetail }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const q = useQuery({ queryKey: ['questions', p.slug], queryFn: () => productApi.questions(p.slug) });
  const ask = useMutation({
    mutationFn: () => productApi.askQuestion(p.slug, text),
    onSuccess: () => {
      setText('');
      toast.success('Đã gửi câu hỏi. Chúng tôi sẽ trả lời sớm nhất!');
      qc.invalidateQueries({ queryKey: ['questions', p.slug] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div>
      <div className="mb-6 rounded-card bg-surface-muted/60 p-5">
        <p className="mb-2 font-semibold">Đặt câu hỏi cho cửa hàng</p>
        {user ? (
          <>
            <Textarea
              aria-label="Câu hỏi"
              placeholder="Nhập câu hỏi của bạn về sản phẩm…"
              rows={3}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setErr('');
              }}
              error={err}
            />
            <Button
              className="mt-3"
              loading={ask.isPending}
              onClick={() => (text.trim().length < 10 ? setErr('Câu hỏi tối thiểu 10 ký tự.') : ask.mutate())}
            >
              Gửi câu hỏi
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">
            Vui lòng{' '}
            <Link
              href={`/login?next=/products/${p.slug}`}
              className="font-semibold text-primary hover:underline"
            >
              đăng nhập
            </Link>{' '}
            để đặt câu hỏi.
          </p>
        )}
      </div>
      {q.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data?.length ? (
        <ul className="space-y-4">
          {q.data.map((x) => (
            <li key={x.id} className="card p-5">
              <p className="font-semibold">
                <span className="mr-2 rounded bg-primary-soft px-1.5 py-0.5 text-xs text-primary">Hỏi</span>
                {x.content}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {x.userName} · {formatDate(x.createdAt)}
              </p>
              {x.answer && (
                <p className="mt-3 rounded-btn bg-surface-muted/70 p-3 text-sm">
                  <span className="mr-2 rounded bg-primary px-1.5 py-0.5 text-xs text-white">Trả lời</span>
                  {x.answer}
                  <span className="mt-1 block text-xs text-muted">
                    {x.answeredBy} · {formatDate(x.answeredAt)}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="message"
          title="Chưa có câu hỏi nào"
          description="Hãy đặt câu hỏi đầu tiên cho sản phẩm này."
        />
      )}
    </div>
  );
}

export default function ProductTabs({
  product: p,
  tab,
  onTab,
}: {
  product: ProductDetail;
  tab: TabKey;
  onTab: (t: TabKey) => void;
}) {
  return (
    <section id="tabs" className="mt-12">
      <Tabs
        value={tab}
        onChange={onTab}
        items={[
          { key: 'desc', label: 'Mô tả sản phẩm' },
          { key: 'specs', label: 'Thông số kỹ thuật' },
          { key: 'reviews', label: `Đánh giá (${p.ratingCount})` },
          { key: 'qa', label: `Hỏi đáp (${p.questionCount})` },
        ]}
      />
      <div className="pt-6">
        {tab === 'desc' && (
          <div className="max-w-3xl space-y-4 text-sm leading-relaxed">
            {p.description?.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <h3 className="pt-2 font-bold">Đặc điểm nổi bật</h3>
            <ul className="list-disc space-y-1.5 pl-5">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {tab === 'specs' && (
          <dl className="max-w-2xl divide-y divide-line overflow-hidden rounded-card border border-line bg-white text-sm">
            {p.specs.map((s) => (
              <div
                key={s.label}
                className="grid grid-cols-[180px_1fr] gap-4 px-4 py-3 odd:bg-surface-muted/40"
              >
                <dt className="font-medium text-muted">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {tab === 'reviews' && <Reviews p={p} />}
        {tab === 'qa' && <Questions p={p} />}
      </div>
    </section>
  );
}
