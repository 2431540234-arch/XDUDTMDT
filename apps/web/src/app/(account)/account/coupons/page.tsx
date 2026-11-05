'use client';

// Mã giảm giá của tôi (WIREFRAME 2.9)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CouponCard, { couponHeadline } from '@/components/account/CouponCard';
import Button from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { formatCurrency } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { couponApi } from '@/services/cart.api';
import { toast } from '@/store/uiStore';

type Tab = 'all' | 'unused' | 'used' | 'expired';

export default function CouponsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const mine = useQuery({ queryKey: ['coupons', 'mine'], queryFn: () => couponApi.mine() });
  const suggested = useQuery({ queryKey: ['coupons', 'suggested'], queryFn: couponApi.suggested });

  const save = useMutation({
    mutationFn: (c: string) => couponApi.save(c),
    onSuccess: () => {
      toast.success('Đã lưu mã giảm giá vào ví của bạn.');
      setCode('');
      setCodeErr('');
      qc.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (e) => {
      setCodeErr(errorMessage(e));
      toast.error(errorMessage(e));
    },
  });

  const all = mine.data ?? [];
  const count = (s: Tab) => (s === 'all' ? all.length : all.filter((x) => x.status === s).length);
  const list = tab === 'all' ? all : all.filter((x) => x.status === tab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Mã giảm giá của tôi</h1>
        <form
          className="mt-4 flex max-w-lg gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return setCodeErr('Vui lòng nhập mã giảm giá.');
            save.mutate(code.trim());
          }}
        >
          <div className="flex-1">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeErr('');
              }}
              placeholder="Nhập mã giảm giá…"
              aria-label="Mã giảm giá"
              className="field uppercase placeholder:normal-case"
            />
            {codeErr && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {codeErr}
              </p>
            )}
          </div>
          <Button type="submit" loading={save.isPending}>
            Áp dụng
          </Button>
        </form>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'all', label: 'Tất cả', count: count('all') },
          { key: 'unused', label: 'Chưa sử dụng', count: count('unused') },
          { key: 'used', label: 'Đã sử dụng', count: count('used') },
          { key: 'expired', label: 'Hết hạn', count: count('expired') },
        ]}
      />
      {mine.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : mine.isError ? (
        <ErrorState onRetry={() => mine.refetch()} />
      ) : list.length ? (
        <div className="space-y-4">
          {list.map((u) => (
            <CouponCard key={u.id} item={u} onUse={() => router.push('/cart')} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="tag"
          title="Chưa có mã giảm giá"
          description="Hãy lưu thêm mã từ mục gợi ý bên dưới."
        />
      )}

      <section>
        <h2 className="mb-4 text-lg font-extrabold">Mã giảm giá gợi ý cho bạn</h2>
        {suggested.isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : suggested.isError ? (
          <ErrorState onRetry={() => suggested.refetch()} />
        ) : suggested.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {suggested.data.map((c) => (
              <div key={c.id} className="card flex flex-col justify-between p-4">
                <div>
                  <p className="text-lg font-extrabold text-primary">{couponHeadline(c)}</p>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.minOrderValue ? `Đơn tối thiểu ${formatCurrency(c.minOrderValue)}` : 'Mọi đơn hàng'}
                  </p>
                  <p className="font-mono text-xs">{c.code}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  loading={save.isPending && save.variables === c.code}
                  onClick={() => save.mutate(c.code)}
                >
                  Lưu mã
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Bạn đã lưu tất cả mã giảm giá đang có.</p>
        )}
      </section>
    </div>
  );
}
