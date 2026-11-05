'use client';

// Đánh giá của tôi (WIREFRAME 2.11) + modal sửa đánh giá (7.8)
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import ReviewCard from '@/components/account/ReviewCard';
import ReviewModal from '@/components/account/ReviewModal';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { myReviewApi } from '@/services/cart.api';
import type { ReviewView } from '@/types/api';

export default function MyReviewsPage() {
  const q = useQuery({ queryKey: ['my-reviews'], queryFn: myReviewApi.list });
  const [editing, setEditing] = useState<ReviewView | null>(null);
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Đánh giá của tôi</h1>
      <p className="mt-1 text-sm text-muted">Xem lại các đánh giá bạn đã gửi cho sản phẩm.</p>
      <div className="mt-5 space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.data?.length ? (
          q.data.map((r) => <ReviewCard key={r.id} review={r} mode="mine" onEdit={setEditing} />)
        ) : (
          <EmptyState
            icon="star"
            title="Bạn chưa có đánh giá nào"
            description="Sau khi nhận hàng, hãy đánh giá sản phẩm để giúp người mua khác."
            action={<LinkButton href="/account/orders">Xem đơn hàng</LinkButton>}
          />
        )}
      </div>
      <ReviewModal open={Boolean(editing)} review={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
