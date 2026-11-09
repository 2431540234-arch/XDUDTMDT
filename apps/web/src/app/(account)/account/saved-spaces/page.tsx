'use client';

// UC-SPACE-04: Không gian mẫu đã lưu. Dùng API hiện có `GET /spaces?bookmarked=true` (chỉ trả của chính người đăng nhập);
// bỏ lưu bằng `DELETE /spaces/:slug/bookmark`. Trang nằm trong khu tài khoản nên đã được bảo vệ bởi AccountLayout (đăng nhập).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import SpaceCard from '@/components/product/SpaceCard';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { errorMessage } from '@/lib/validators';
import { spaceApi } from '@/services/space.api';
import { toast } from '@/store/uiStore';

const PAGE_SIZE = 12;

export default function SavedSpacesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['spaces', 'saved', page],
    queryFn: () => spaceApi.list({ bookmarked: true, page, pageSize: PAGE_SIZE }),
  });
  const items = q.data?.items ?? [];
  const totalPages = q.data?.meta?.totalPages ?? 1;

  const remove = useMutation({
    mutationFn: (slug: string) => spaceApi.unbookmark(slug),
    onSuccess: async () => {
      toast.success('Đã bỏ lưu không gian.');
      await qc.invalidateQueries({ queryKey: ['spaces'] });
      // bỏ lưu mục cuối của trang > 1 ⇒ lùi về trang trước để không rơi vào trang rỗng
      if (items.length <= 1 && page > 1) setPage(page - 1);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section aria-labelledby="saved-spaces-title" className="space-y-5">
      <div>
        <h1 id="saved-spaces-title" className="text-2xl font-extrabold">
          Không gian đã lưu
        </h1>
        <p className="mt-1 text-sm text-muted">Các không gian mẫu bạn đã lưu để xem lại.</p>
      </div>

      {q.isLoading ? (
        <div data-testid="saved-spaces-loading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message="Không tải được danh sách không gian đã lưu." onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="home"
          title="Bạn chưa lưu không gian nào"
          description="Bấm biểu tượng trái tim ở một không gian mẫu để lưu lại và xem sau."
          action={
            <Link href="/spaces">
              <Button>Khám phá không gian mẫu</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ul data-testid="saved-spaces-list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <li key={s.id} className="space-y-2">
                {/* SpaceCard có sẵn nút ♡ (bỏ lưu); nút "Bỏ lưu" bên dưới rõ ràng hơn cho trang danh sách */}
                <SpaceCard space={s} />
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  loading={remove.isPending && remove.variables === s.slug}
                  onClick={() => remove.mutate(s.slug)}
                >
                  Bỏ khỏi danh sách
                </Button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
        </>
      )}
    </section>
  );
}
