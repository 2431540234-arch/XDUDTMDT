// Service gọi API giỏ hàng, mã giảm giá, đặt hàng, thanh toán, đơn hàng, đổi trả
import type { OrderStatus, PaymentMethod } from '@aurelia-living/shared-types';
import type { CartView, CouponView, OrderView, ReturnRequest, ReviewView, UserCouponView } from '@/types/api';
import { http } from './api-client';

export const cartApi = {
  get: (q?: { items?: number[]; addressId?: number | null }) => http.get<CartView>('/cart', q),
  addItem: (body: { variantId: number; quantity: number }) => http.post<CartView>('/cart/items', body),
  updateItem: (id: number, quantity: number) => http.patch<CartView>(`/cart/items/${id}`, { quantity }),
  removeItem: (id: number) => http.delete<CartView>(`/cart/items/${id}`),
  clear: () => http.delete<CartView>('/cart'),
  /** BE thật: POST /coupons/validate (chỉ xem trước, D-N16). Mock lưu mã vào giỏ để tính lại tổng. */
  applyCoupon: (code: string) => http.post<CartView>('/cart/coupon', { code }),
  removeCoupon: () => http.delete<CartView>('/cart/coupon'),
};

export interface CheckoutBody {
  addressId: number;
  paymentMethod: PaymentMethod;
  note?: string;
  /** Mua ngay: chỉ đặt các dòng này (mặc định: cả giỏ) */
  itemIds?: number[];
}

export const orderApi = {
  create: (body: CheckoutBody) => http.post<OrderView>('/orders', body),
  list: (q: { status?: OrderStatus; page?: number; pageSize?: number } = {}) =>
    http.list<OrderView>('/orders', q),
  detail: (code: string) => http.get<OrderView>(`/orders/${code}`),
  cancel: (id: number, reason?: string) => http.post<OrderView>(`/orders/${id}/cancel`, { reason }),
  counts: () => http.get<Record<string, number>>('/orders/counts'), // TODO: chưa có trong BE
  /** Giả lập cổng thanh toán: trả về URL điều hướng (thành công hoặc thất bại) */
  checkout: (orderId: number, outcome: 'success' | 'failed' = 'success') =>
    http.post<{ redirectUrl: string }>(`/payments/${orderId}/checkout`, { outcome }),
  retryPayment: (orderId: number, method?: PaymentMethod) =>
    http.post<{ redirectUrl: string }>(`/payments/${orderId}/retry`, { method }),
};

export const returnApi = {
  // TODO: chưa có trong BE
  list: (q: { status?: string; page?: number } = {}) => http.list<ReturnRequest>('/returns', q),
  create: (body: {
    orderId: number;
    items: Array<{ orderItemId: number; quantity: number }>;
    type: 'refund' | 'exchange';
    reason: ReturnRequest['reason'];
    description: string;
    images: string[];
  }) => http.post<ReturnRequest>('/returns', body),
};

export const couponApi = {
  mine: (q: { status?: string } = {}) => http.get<UserCouponView[]>('/coupons/me', q), // TODO: chưa có trong BE
  suggested: () => http.get<CouponView[]>('/coupons/suggested'), // TODO: chưa có trong BE
  save: (code: string) => http.post<UserCouponView>('/coupons/save', { code }), // TODO: chưa có trong BE
};

export const myReviewApi = {
  list: () => http.get<ReviewView[]>('/reviews/me'), // TODO: chưa có trong BE
  update: (id: number, body: { rating: number; content: string; tags?: string[] }) =>
    http.patch<ReviewView>(`/reviews/${id}`, body),
  remove: (id: number) => http.delete(`/reviews/${id}`),
};
