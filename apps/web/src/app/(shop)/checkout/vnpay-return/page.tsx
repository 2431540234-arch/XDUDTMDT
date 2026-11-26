'use client';

// Return URL của VNPAY. Trang CHỈ hiển thị: gửi nguyên tham số cho API kiểm chữ ký, trạng thái lấy từ CSDL.
// Không bao giờ báo thành công chỉ dựa vào tham số trên URL.
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { paymentApi } from '@/services/cart.api';

/** Hỏi lại mỗi 3 giây, tối đa ngần này lần, trong lúc chờ cổng xác nhận */
const MAX_POLLS = 10;
const POLL_MS = 3000;

function Content() {
  const params = useSearchParams();
  const query = Object.fromEntries(params.entries());
  const q = useQuery({
    queryKey: ['vnpay-return', params.toString()],
    queryFn: () => paymentApi.vnpayReturnStatus(query),
    refetchInterval: (state) => {
      const d = state.state.data;
      if (!d?.valid || d.paymentStatus !== 'unpaid') return false;
      return state.state.dataUpdateCount < MAX_POLLS ? POLL_MS : false;
    },
    refetchOnWindowFocus: false,
  });

  if (q.isLoading)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (q.isError)
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => q.refetch()} />
      </div>
    );
  const d = q.data!;
  if (!d.valid)
    return (
      <div className="container-page py-8">
        <EmptyState
          title="Không xác thực được kết quả thanh toán"
          action={<LinkButton href="/account/orders">Xem đơn hàng của tôi</LinkButton>}
        />
      </div>
    );

  const paid = d.paymentStatus === 'paid';
  const refunded = d.paymentStatus === 'refunded';
  // cổng báo không thành công: không cần chờ thêm để kết luận lần thử này
  const failed = !paid && !refunded && d.responseCode !== '00';
  const view = paid
    ? {
        icon: 'check' as const,
        tone: 'bg-emerald-100 text-emerald-600',
        title: 'Thanh toán thành công',
        text: 'Chúng tôi đã nhận được thanh toán của bạn.',
      }
    : refunded
      ? {
          icon: 'check' as const,
          tone: 'bg-surface-muted text-muted',
          title: 'Đơn hàng đã được hoàn tiền',
          text: 'Xem chi tiết đơn hàng để biết thêm.',
        }
      : failed
        ? {
            icon: 'close' as const,
            tone: 'bg-rose-100 text-danger',
            title: 'Thanh toán không thành công',
            text: 'Giao dịch chưa hoàn tất. Đơn hàng vẫn được giữ, bạn có thể thanh toán lại.',
          }
        : {
            icon: 'receipt' as const,
            tone: 'bg-amber-100 text-amber-700',
            title: 'Đang chờ VNPAY xác nhận',
            text: 'Chưa nhận được xác nhận thanh toán. Vui lòng xem trạng thái mới nhất ở chi tiết đơn hàng và đừng thanh toán lại ngay nếu tài khoản đã bị trừ tiền.',
          };

  return (
    <div className="container-page py-8">
      <div className="card mx-auto max-w-2xl p-6 text-center sm:p-10" data-testid="vnpay-return">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${view.tone}`}>
          <Icon name={view.icon} size={42} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">{view.title}</h1>
        <p className="mt-1 text-sm font-bold">#{d.orderCode}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{view.text}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href={`/account/orders/${d.orderCode}`} size="lg">
            Xem chi tiết đơn hàng
          </LinkButton>
          {failed && (
            <LinkButton href={`/checkout/failed?order=${d.orderCode}`} size="lg" variant="outline">
              Thanh toán lại
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VnpayReturnPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
