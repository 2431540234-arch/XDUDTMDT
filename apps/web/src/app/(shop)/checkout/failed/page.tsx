'use client';

// Thanh toán thất bại (WIREFRAME 7.2 – biến thể thất bại; cũng là URL trả về từ cổng thanh toán)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useRequireCustomer } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { paymentMethodLabel } from '@/lib/status';
import { navigateTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/validators';
import { orderApi } from '@/services/cart.api';
import { toast } from '@/store/uiStore';
import type { PaymentMethod } from '@aurelia-living/shared-types';

function Content() {
  const { ready } = useRequireCustomer();
  const code = useSearchParams().get('order') ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const [pick, setPick] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('vnpay');
  const q = useQuery({
    queryKey: ['order', code],
    queryFn: () => orderApi.detail(code),
    enabled: ready && Boolean(code),
  });
  const retry = useMutation({
    mutationFn: (m?: PaymentMethod) => orderApi.retryPayment(q.data!.id, m),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['order', code] });
      navigateTo(router, r.redirectUrl);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!ready || q.isLoading)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (!code || q.isError)
    return (
      <div className="container-page py-8">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <EmptyState
            title="Không tìm thấy đơn hàng"
            action={<LinkButton href="/account/orders">Xem đơn hàng của tôi</LinkButton>}
          />
        )}
      </div>
    );
  const o = q.data!;
  const methods: PaymentMethod[] = ['vnpay', 'card', 'momo', 'zalopay', 'bank_transfer', 'cod'];
  return (
    <div className="container-page py-6">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Giỏ hàng', href: '/cart' },
          { label: 'Thanh toán', href: '/checkout' },
          { label: 'Thất bại' },
        ]}
      />
      <div className="card mx-auto max-w-2xl p-6 text-center sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-danger">
          <Icon name="close" size={42} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Thanh toán không thành công</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Giao dịch cho đơn hàng <b>#{o.orderCode}</b> ({formatCurrency(o.total)}) chưa được hoàn tất. Đơn
          hàng vẫn được giữ, bạn có thể thanh toán lại hoặc chọn phương thức khác.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" loading={retry.isPending} onClick={() => retry.mutate(undefined)}>
            Thử thanh toán lại
          </Button>
          <Button size="lg" variant="outline" onClick={() => setPick(true)}>
            Chọn phương thức khác
          </Button>
        </div>
        <LinkButton href={`/account/orders/${o.orderCode}`} variant="ghost" className="mt-3">
          Xem chi tiết đơn hàng
        </LinkButton>
      </div>
      <Modal
        open={pick}
        onClose={() => setPick(false)}
        title="Chọn phương thức thanh toán"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPick(false)}>
              Hủy
            </Button>
            <Button loading={retry.isPending} onClick={() => retry.mutate(method)}>
              Thanh toán
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {methods.map((m) => (
            <label
              key={m}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-btn border px-3 py-2.5 text-sm',
                method === m ? 'border-primary bg-primary-soft/40' : 'border-line',
              )}
            >
              <input
                type="radio"
                name="m"
                className="accent-primary"
                checked={method === m}
                onChange={() => setMethod(m)}
              />{' '}
              {paymentMethodLabel[m]}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
