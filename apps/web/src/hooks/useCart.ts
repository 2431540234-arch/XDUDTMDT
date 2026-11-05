'use client';

// Hook giỏ hàng + yêu thích + thông báo (đếm badge trên Header)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/services/api-client';
import { cartApi } from '@/services/cart.api';
import { notificationApi } from '@/services/content.api';
import { wishlistApi } from '@/services/product.api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';

export const queryKeys = {
  cart: ['cart'] as const,
  wishlist: ['wishlist'] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
};

export function useCartQuery() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: cartApi.get,
    enabled: Boolean(user),
    staleTime: 15_000,
  });
}

export function useCartActions() {
  const qc = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const set = (cart: unknown) => qc.setQueryData(queryKeys.cart, cart);
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiClientError ? e.message : 'Không thể cập nhật giỏ hàng.');

  const add = useMutation({
    mutationFn: cartApi.addItem,
    onSuccess: (c) => {
      set(c);
      toast.success('Đã thêm vào giỏ hàng.');
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) => cartApi.updateItem(id, quantity),
    onSuccess: set,
    onError,
  });
  const remove = useMutation({
    mutationFn: cartApi.removeItem,
    onSuccess: (c) => {
      set(c);
      toast.success('Đã xoá sản phẩm khỏi giỏ hàng.');
    },
    onError,
  });

  return {
    update,
    remove,
    /** Thêm vào giỏ; chưa đăng nhập thì chuyển tới /login (khách vãng lai không có giỏ – D-P02) */
    addToCart: async (variantId: number, quantity = 1) => {
      if (!user) {
        toast.info('Vui lòng đăng nhập để thêm vào giỏ hàng.');
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return null;
      }
      return add.mutateAsync({ variantId, quantity }).catch(() => null);
    },
    adding: add.isPending,
  };
}

export function useWishlist() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: wishlistApi.list,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const slugs = new Set((q.data ?? []).map((p) => p.slug));

  const toggle = useMutation({
    mutationFn: async ({ slug, on }: { slug: string; on: boolean }) =>
      on ? wishlistApi.add(slug) : wishlistApi.remove(slug),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.wishlist });
      toast.success(v.on ? 'Đã thêm vào yêu thích.' : 'Đã bỏ khỏi yêu thích.');
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'Không thể cập nhật yêu thích.'),
  });

  return {
    count: slugs.size,
    has: (slug: string) => slugs.has(slug),
    toggle: (slug: string) => {
      if (!user) {
        toast.info('Vui lòng đăng nhập để lưu sản phẩm yêu thích.');
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      toggle.mutate({ slug, on: !slugs.has(slug) });
    },
  };
}

export function useUnreadCount() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.unread,
    queryFn: notificationApi.unreadCount,
    enabled: Boolean(user),
    staleTime: 20_000,
  });
}
