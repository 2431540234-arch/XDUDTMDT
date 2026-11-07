'use client';

// Thanh toán (WIREFRAME 2.5): thông tin nhận hàng → phương thức thanh toán → đơn hàng; tóm tắt bên phải
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import AddressFormModal from '@/components/account/AddressFormModal';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useRequireCustomer } from '@/hooks/useAuth';
import { queryKeys } from '@/hooks/useCart';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { paymentMethodLabel } from '@/lib/status';
import { navigateTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/validators';
import { addressApi } from '@/services/auth.api';
import { cartApi, orderApi } from '@/services/cart.api';
import { contentApi } from '@/services/content.api';
import { toast } from '@/store/uiStore';
import type { AddressView } from '@/types/api';
import type { PaymentMethod } from '@aurelia-living/shared-types';

const GROUPS: Array<{ title: string; methods: PaymentMethod[]; logos?: string[] }> = [
  { title: 'Thanh toán khi nhận hàng', methods: ['cod'] },
  { title: 'Chuyển khoản ngân hàng', methods: ['bank_transfer'] },
  { title: 'Thẻ ngân hàng / Thẻ tín dụng', methods: ['card'], logos: ['VISA', 'Mastercard', 'JCB'] },
  { title: 'Ví điện tử', methods: ['momo', 'zalopay', 'vnpay'] },
];

function Step({
  n,
  title,
  action,
  children,
}: {
  n: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-3 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-white">
            {n}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CheckoutContent() {
  const { ready } = useRequireCustomer();
  const router = useRouter();
  const qc = useQueryClient();
  const sp = useSearchParams();
  const itemIds = (sp.get('items') ?? '').split(',').filter(Boolean).map(Number);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [note, setNote] = useState('');
  const [agree, setAgree] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; address: AddressView | null }>({
    open: false,
    address: null,
  });

  const addresses = useQuery({ queryKey: ['addresses'], queryFn: addressApi.list, enabled: ready });
  const settings = useQuery({ queryKey: ['settings-public'], queryFn: contentApi.settings });
  useEffect(() => {
    if (!addressId && addresses.data?.length)
      setAddressId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id);
  }, [addresses.data, addressId]);

  const cart = useQuery({
    queryKey: ['cart', 'checkout', itemIds.join(','), addressId],
    queryFn: () => cartApi.get({ items: itemIds, addressId }),
    enabled: ready && Boolean(addressId || addresses.isSuccess),
  });

  const place = useMutation({
    mutationFn: async () => {
      const order = await orderApi.create({
        addressId: addressId!,
        paymentMethod: method,
        note: note.trim() || undefined,
        itemIds: itemIds.length ? itemIds : undefined,
      });
      const pay = await orderApi.checkout(order.id);
      return pay.redirectUrl;
    },
    onSuccess: (url) => {
      qc.invalidateQueries({ queryKey: queryKeys.cart });
      qc.invalidateQueries({ queryKey: ['orders'] });
      navigateTo(router, url);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!ready || addresses.isLoading || cart.isLoading)
    return (
      <div className="container-page py-8">
        <PageSkeleton />
      </div>
    );
  if (addresses.isError || cart.isError)
    return (
      <div className="container-page py-8">
        <ErrorState
          onRetry={() => {
            addresses.refetch();
            cart.refetch();
          }}
        />
      </div>
    );
  const c = cart.data!;
  if (!c.items.length) {
    return (
      <div className="container-page py-8">
        <EmptyState
          icon="cart"
          title="Không có sản phẩm để thanh toán"
          description="Giỏ hàng của bạn đang trống."
          action={<LinkButton href="/products">Tiếp tục mua sắm</LinkButton>}
        />
      </div>
    );
  }
  const enabled = new Set(
    (settings.data?.payments ?? []).filter((p) => p.enabled).map((p) => p.method as string),
  );
  const addr = addresses.data?.find((a) => a.id === addressId);

  const submit = () => {
    if (!addr) return toast.error('Vui lòng chọn hoặc thêm địa chỉ nhận hàng.');
    if (!agree) return toast.error('Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.');
    place.mutate();
  };

  return (
    <div className="container-page py-6">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Giỏ hàng', href: '/cart' },
          { label: 'Thanh toán' },
        ]}
      />
      <h1 className="mb-5 text-2xl font-extrabold">Thanh toán</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Step
            n={1}
            title="Thông tin nhận hàng"
            action={
              <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, address: null })}>
                <Icon name="plus" size={14} /> Thêm địa chỉ
              </Button>
            }
          >
            {addresses.data?.length ? (
              <ul className="space-y-3">
                {addresses.data.map((a) => (
                  <li key={a.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-card border p-4',
                        addressId === a.id
                          ? 'border-primary bg-primary-soft/40'
                          : 'border-line hover:border-primary/50',
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-1 accent-primary"
                        checked={addressId === a.id}
                        onChange={() => setAddressId(a.id)}
                      />
                      <span className="flex-1 text-sm">
                        <span className="flex items-center gap-2 font-semibold">
                          {a.recipientName} · {a.phone}{' '}
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-normal">
                            {a.label}
                          </span>
                          {a.isDefault && (
                            <span className="rounded bg-primary px-1.5 py-0.5 text-xs font-normal text-white">
                              Mặc định
                            </span>
                          )}
                        </span>
                        <span className="text-muted">
                          {a.addressLine}, {a.ward}, {a.district}, {a.province}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          setModal({ open: true, address: a });
                        }}
                      >
                        Sửa
                      </button>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Bạn chưa có địa chỉ nhận hàng. Hãy thêm địa chỉ mới để tiếp tục.
              </p>
            )}
          </Step>

          <Step n={2} title="Phương thức thanh toán">
            <div className="space-y-4">
              {GROUPS.map((g) => {
                const methods = g.methods.filter((m) => enabled.size === 0 || enabled.has(m));
                if (!methods.length) return null;
                return (
                  <div key={g.title}>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      {g.title}
                      {g.logos?.map((l) => (
                        <span
                          key={l}
                          className="rounded border border-line px-1.5 text-[10px] font-bold text-muted"
                        >
                          {l}
                        </span>
                      ))}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {methods.map((m) => (
                        <label
                          key={m}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-btn border px-3 py-2.5 text-sm',
                            method === m
                              ? 'border-primary bg-primary-soft/40'
                              : 'border-line hover:border-primary/50',
                          )}
                        >
                          <input
                            type="radio"
                            name="method"
                            className="accent-primary"
                            checked={method === m}
                            onChange={() => setMethod(m)}
                          />
                          {g.methods.length > 1 || m === 'card'
                            ? paymentMethodLabel[m].replace('Ví ', '')
                            : paymentMethodLabel[m]}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {['card', 'momo', 'zalopay', 'vnpay'].includes(method) && (
                <p className="rounded-btn bg-surface-muted px-3 py-2 text-xs text-muted">
                  Bạn sẽ được chuyển tới cổng thanh toán (sandbox mô phỏng) để hoàn tất giao dịch.
                </p>
              )}
            </div>
          </Step>

          <Step
            n={3}
            title="Đơn hàng của bạn"
            action={
              <Link href="/cart" className="text-sm font-semibold text-primary hover:underline">
                Sửa
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {c.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-1 font-semibold">{it.productName}</p>
                    <p className="text-xs text-muted">
                      {it.variantLabel} · x{it.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </Step>
        </div>

        <aside className="card h-fit space-y-3 p-5 text-sm">
          <h2 className="text-lg font-extrabold">Tóm tắt đơn hàng</h2>
          <div className="flex justify-between">
            <span className="text-muted">Tạm tính</span>
            <span className="font-semibold">{formatCurrency(c.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Giảm giá{c.coupon ? ` (${c.coupon.code})` : ''}</span>
            <span className="font-semibold text-danger">
              {c.discountAmount ? `-${formatCurrency(c.discountAmount)}` : formatCurrency(0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Phí vận chuyển</span>
            <span className="font-semibold">
              {c.shippingFee ? formatCurrency(c.shippingFee) : 'Miễn phí'}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-bold">Tổng cộng</span>
            <span className="text-2xl font-extrabold text-primary">{formatCurrency(c.total)}</span>
          </div>
          <Textarea
            label="Ghi chú đơn hàng (nếu có)"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: giao giờ hành chính…"
          />
          <label className="flex items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              Bằng việc đặt hàng, bạn đồng ý với{' '}
              <Link href="/policies/dieu-khoan-su-dung" className="text-primary underline">
                Điều khoản dịch vụ
              </Link>{' '}
              và{' '}
              <Link href="/policies/chinh-sach-bao-mat" className="text-primary underline">
                Chính sách bảo mật
              </Link>
              .
            </span>
          </label>
          <Button size="lg" block loading={place.isPending} onClick={submit}>
            Đặt hàng
          </Button>
        </aside>
      </div>
      <AddressFormModal
        open={modal.open}
        address={modal.address}
        onClose={() => setModal({ open: false, address: null })}
        onSaved={(a) => setAddressId(a.id)}
      />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutContent />
    </Suspense>
  );
}
