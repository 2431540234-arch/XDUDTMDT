'use client';

// Câu hỏi thường gặp (WIREFRAME 7.13)
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { contentApi } from '@/services/content.api';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export default function FaqPage() {
  const q = useQuery({ queryKey: ['faq'], queryFn: contentApi.faq });
  const [topic, setTopic] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const all = (q.data ?? []).flatMap((t) =>
      t.items.map((i) => ({ ...i, topic: t.key, topicLabel: t.label, key: `${t.key}-${i.id}` })),
    );
    return all.filter(
      (r) =>
        (topic === 'all' || r.topic === topic) &&
        (!search || fold(`${r.question} ${r.answer}`).includes(fold(search))),
    );
  }, [q.data, topic, search]);

  return (
    <div>
      <section className="bg-surface-muted py-10">
        <div className="container-page">
          <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Câu hỏi thường gặp' }]} />
          <h1 className="text-3xl font-extrabold">Câu hỏi thường gặp</h1>
          <p className="mt-1 text-muted">Tìm câu trả lời nhanh cho những thắc mắc phổ biến.</p>
          <div className="relative mt-5 max-w-2xl">
            <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm câu hỏi…"
              aria-label="Tìm câu hỏi"
              className="field !py-3.5 pl-12"
            />
          </div>
        </div>
      </section>
      <div className="container-page grid gap-6 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit p-3">
          <nav aria-label="Chủ đề" className="flex gap-1 overflow-x-auto lg:flex-col">
            {[{ key: 'all', label: 'Tất cả chủ đề' }, ...(q.data ?? [])].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTopic(t.key)}
                aria-pressed={topic === t.key}
                className={cn(
                  'whitespace-nowrap rounded-btn px-3 py-2.5 text-left text-sm font-medium',
                  topic === t.key ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted/60',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>
        <div>
          {q.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : rows.length ? (
            <ul className="space-y-3">
              {rows.map((r) => {
                const isOpen = open === r.key;
                return (
                  <li
                    key={r.key}
                    className={cn('rounded-card border bg-white', isOpen ? 'border-primary' : 'border-line')}
                  >
                    <h3>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : r.key)}
                        className="flex w-full items-center justify-between gap-4 p-4 text-left font-semibold"
                      >
                        {r.question}
                        <Icon
                          name={isOpen ? 'chevronUp' : 'chevronDown'}
                          size={18}
                          className="shrink-0 text-primary"
                        />
                      </button>
                    </h3>
                    {isOpen && (
                      <p className="border-t border-line px-4 py-4 text-sm leading-relaxed text-muted">
                        {r.answer}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon="search"
              title="Không tìm thấy câu hỏi phù hợp"
              description="Hãy thử từ khóa khác hoặc gửi câu hỏi cho chúng tôi."
            />
          )}
          <section className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-surface-muted p-6 sm:flex-row">
            <div>
              <h2 className="text-lg font-extrabold">Không tìm thấy câu trả lời?</h2>
              <p className="text-sm text-muted">Liên hệ trực tiếp để được tư vấn nhanh nhất.</p>
            </div>
            <div className="flex gap-2">
              <LinkButton href="tel:0123456789" variant="outline">
                <Icon name="phone" size={16} /> 0123 456 789
              </LinkButton>
              <LinkButton href="/contact">Gửi câu hỏi</LinkButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
