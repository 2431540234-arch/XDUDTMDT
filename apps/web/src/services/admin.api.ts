// Service gọi API khu vực quản trị (/api/admin/*) – chỉ tài khoản role 'admin' (Doanh nghiệp)
import type { Coupon, OrderStatus, ReviewStatus } from '@aurelia-living/shared-types';
import type {
  AdminMaterialVariant,
  MaterialConfig,
  PlacementView,
  CategoryNode,
  CouponView,
  DashboardStats,
  FinanceReport,
  InventoryRow,
  Model3DAdminRow,
  ModelReviewDetail,
  ModelVariantKey,
  OrderView,
  ProductDetail,
  ProductListItem,
  ReviewView,
  SpaceDetail,
  SpaceListItem,
  StoreSettings,
  ActivityLogOptions,
  ActivityLogRow,
  AttributeAdmin,
  RoleView,
  ModelProcessingAccepted,
  ShipmentResult,
  MediaAdmin,
  AttributeValueAdmin,
  UserView,
} from '@/types/api';
import { readAsDataUrl } from '@/components/admin/UploadDropzone';
import type { PresignedUpload } from '@aurelia-living/shared-types';
import { USE_MOCK, http, type Query, fetchBinary } from './api-client';
import { getUploadMode, putToStorage } from './direct-upload';

/** Một giao dịch trong danh sách GET /admin/payments (UC-ADM-24) */
export interface AdminPayment {
  id: number;
  orderId: number;
  orderCode: string;
  orderStatus: string;
  orderPaymentStatus: string;
  customerName: string;
  customerEmail: string | null;
  method: 'cod' | 'bank_transfer' | 'momo' | 'vnpay' | 'zalopay' | 'card';
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  transactionCode: string | null;
  paidAt: string | null;
  createdAt: string;
}

export const adminApi = {
  payments: {
    list: (q: Record<string, string | number | boolean | undefined>) =>
      http.list<AdminPayment>('/admin/payments', q as Record<string, string | number | boolean>),
  },
  stats: (q: { from?: string; to?: string }) => http.get<DashboardStats>('/admin/stats/overview', q),
  finance: (q: { from?: string; to?: string }) => http.get<FinanceReport>('/admin/stats/finance', q),

  products: {
    list: (q: Query) => http.list<ProductListItem>('/admin/products', q),
    get: (id: number) => http.get<ProductDetail>(`/admin/products/${id}`),
    create: (body: Record<string, unknown>) => http.post<ProductDetail>('/admin/products', body),
    update: (id: number, body: Record<string, unknown>) =>
      http.patch<ProductDetail>(`/admin/products/${id}`, body),
    remove: (id: number) => http.delete(`/admin/products/${id}`),
  },
  categories: {
    tree: () => http.get<CategoryNode[]>('/admin/categories'),
    create: (body: Record<string, unknown>) => http.post<CategoryNode>('/admin/categories', body),
    update: (id: number, body: Record<string, unknown>) =>
      http.patch<CategoryNode>(`/admin/categories/${id}`, body),
    remove: (id: number) => http.delete(`/admin/categories/${id}`),
  },
  orders: {
    list: (q: Query) => http.list<OrderView>('/admin/orders', q),
    counts: () => http.get<Record<string, number>>('/admin/orders/counts'),
    create: (body: {
      userId: number;
      paymentMethod: string;
      note?: string;
      items: Array<{ variantId: number; quantity: number }>;
    }) => http.post<OrderView>('/admin/orders', body),
    get: (code: string) => http.get<OrderView>(`/admin/orders/${code}`),
    setStatus: (id: number, status: OrderStatus, note?: string) =>
      http.patch<OrderView>(`/admin/orders/${id}/status`, { status, note }),
    cancel: (id: number, reason: string) => http.post<OrderView>(`/admin/orders/${id}/cancel`, { reason }),
    refund: (id: number) => http.post<OrderView>(`/admin/orders/${id}/refund`),
    createShipment: (id: number, body: { carrier: string; trackingCode?: string; fee?: number }) =>
      http.post<ShipmentResult>(`/admin/orders/${id}/shipments`, body),
    updateShipment: (
      id: number,
      body: { status?: string; carrier?: string; trackingCode?: string; fee?: number },
    ) => http.patch<ShipmentResult>(`/admin/shipments/${id}`, body),
    /** UC-ADM-24: xác nhận đã nhận tiền chuyển khoản (transactionCode tùy chọn, duy nhất) */
    confirmPayment: (id: number, body?: { transactionCode?: string }) =>
      http.patch<OrderView>(`/admin/payments/${id}/confirm`, body),
    /** UC-ADM-24: đánh dấu giao dịch chuyển khoản thất bại */
    failPayment: (id: number, body?: { reason?: string }) =>
      http.patch<OrderView>(`/admin/payments/${id}/fail`, body),
    saveNote: (id: number, note: string) => http.patch<OrderView>(`/admin/orders/${id}/note`, { note }),
  },
  customers: {
    list: (q: Query) => http.list<UserView>('/admin/users', q),
    get: (id: number) =>
      http.get<
        UserView & { addresses: unknown[]; recentActivity: Array<{ text: string; createdAt: string }> }
      >(`/admin/users/${id}`),
    setStatus: (id: number, status: 'active' | 'suspended') =>
      http.patch<UserView>(`/admin/users/${id}/status`, { status }),
    /** UC-ADM-02: gán/gỡ vai trò admin ⇒ { id, roles } (409 khi tự gỡ của mình hoặc gỡ admin cuối cùng) */
    grantAdmin: (id: number) => http.put<{ id: number; roles: string[] }>(`/admin/users/${id}/roles/admin`),
    revokeAdmin: (id: number) =>
      http.delete<{ id: number; roles: string[] }>(`/admin/users/${id}/roles/admin`),
    create: (body: Record<string, unknown>) => http.post<UserView>('/admin/users', body),
    update: (id: number, body: Record<string, unknown>) => http.patch<UserView>(`/admin/users/${id}`, body),
    orders: (id: number, q: Query = {}) => http.list<OrderView>(`/admin/users/${id}/orders`, q),
    reviews: (id: number) => http.get<ReviewView[]>(`/admin/users/${id}/reviews`),
    wishlist: (id: number) => http.get<ProductListItem[]>(`/admin/users/${id}/wishlist`),
  },
  reviews: {
    list: (q: Query) => http.list<ReviewView>('/admin/reviews', q),
    setStatus: (id: number, status: ReviewStatus) =>
      http.patch<ReviewView>(`/admin/reviews/${id}/status`, { status }),
  },
  models: {
    list: (q: Query) => http.list<Model3DAdminRow>('/admin/models', q),
    /** Máy chủ thật: multipart ⇒ 202 (xử lý nền, trạng thái processing); dữ liệu giả: JSON metadata */
    upload: async (
      file: File,
      meta: {
        productId: number;
        format: 'glb';
        /** gỡ tấm sàn thừa nếu phát hiện */
        removeFloor: boolean;
        /** phần trăm tải lên kho (chỉ có khi tải thẳng lên MinIO) */
        onProgress?: (percent: number) => void;
      },
    ) => {
      if (USE_MOCK) {
        return http.post<unknown>('/admin/models', {
          productId: meta.productId,
          fileName: file.name,
          sizeMB: Math.max(0.1, file.size / 1048576),
          format: meta.format,
          removeFloor: meta.removeFloor,
          fileUrl: URL.createObjectURL(file),
        });
      }
      // Kho MinIO/S3 (UC-ADM-13 bước 4–5): presign ⇒ PUT thẳng lên bucket PRIVATE ⇒ confirm (202, xử lý nền)
      if ((await getUploadMode()) === 'presigned') {
        const p = await http.post<PresignedUpload & { modelId: number }>('/admin/models/presign', {
          productId: meta.productId,
          fileName: file.name,
          size: file.size,
          format: meta.format,
          removeFloor: meta.removeFloor,
        });
        await putToStorage(p, file, meta.onProgress);
        return http.post<ModelProcessingAccepted>(`/admin/models/${p.modelId}/files/confirm`, {
          key: p.key,
          format: meta.format,
          fileName: file.name,
        });
      }
      const form = new FormData();
      form.append('file', file);
      form.append('productId', String(meta.productId));
      form.append('removeFloor', String(meta.removeFloor));
      return http.post<ModelProcessingAccepted>('/admin/models/upload', form);
    },
    /** Màn duyệt */
    detail: (modelId: number) => http.get<ModelReviewDetail>(`/admin/models/${modelId}`),
    /** URL xem thử bản CHỜ DUYỆT (tệp private ⇒ tải có đăng nhập rồi tạo URL tạm; gọi xong nhớ revoke) */
    previewUrl: async (detail: ModelReviewDetail, variant: ModelVariantKey) => {
      if (USE_MOCK) return detail.mockPreviewUrl ?? '';
      const blob = await fetchBinary(`/admin/models/${detail.id}/preview`, { variant, lod: 'medium' });
      return URL.createObjectURL(blob);
    },
    approve: (modelId: number, body: { variant: ModelVariantKey; posterDataUrl?: string }) =>
      http.post<{ modelId: number; productId: number; status: 'ready' }>(
        `/admin/models/${modelId}/approve`,
        body,
      ),
    reject: (modelId: number) => http.post<null>(`/admin/models/${modelId}/reject`),
    renormalize: (modelId: number, body: { yawDeg?: number; removeFloor?: boolean }) =>
      http.post<ModelProcessingAccepted>(`/admin/models/${modelId}/renormalize`, body),
    /** Xóa một tệp (dòng có fileId) */
    remove: (id: number) => http.delete(`/admin/models/${id}`),
    /** Xóa cả mô hình chưa có tệp (đang xử lý / lỗi) */
    removeModel: (modelId: number) => http.delete(`/admin/models/model/${modelId}`),
    /** UC-ADM-14: vật liệu theo biến thể (:modelId là id MÔ HÌNH) */
    materialNames: (modelId: number) => http.get<{ names: string[] }>(`/admin/models/${modelId}/materials`),
    materialVariants: (modelId: number) =>
      http.get<AdminMaterialVariant[]>(`/admin/models/${modelId}/material-variants`),
    setMaterialVariant: (
      modelId: number,
      variantId: number,
      body: { materialName: string; config: MaterialConfig },
    ) => http.put<AdminMaterialVariant>(`/admin/models/${modelId}/material-variants/${variantId}`, body),
    removeMaterialVariant: (modelId: number, variantId: number) =>
      http.delete(`/admin/models/${modelId}/material-variants/${variantId}`),
    /** failed → processing; :id là id MÔ HÌNH */
    reprocess: (modelId: number) => http.post<ModelProcessingAccepted>(`/admin/models/${modelId}/reprocess`),
    setPrimary: (modelId: number) =>
      http.patch<{ modelId: number; productId: number; isPrimary: true }>(`/admin/models/${modelId}/primary`),
  },
  coupons: {
    list: (q: Query) => http.list<CouponView>('/admin/coupons', q),
    get: (id: number) => http.get<CouponView>(`/admin/coupons/${id}`),
    create: (body: Partial<CouponView>) => http.post<CouponView>('/admin/coupons', body),
    update: (id: number, body: Partial<Coupon> & Record<string, unknown>) =>
      http.patch<CouponView>(`/admin/coupons/${id}`, body),
    remove: (id: number) => http.delete(`/admin/coupons/${id}`),
  },
  spaces: {
    list: (q: Query) => http.list<SpaceListItem>('/admin/spaces', q),
    get: (id: number) => http.get<SpaceDetail>(`/admin/spaces/${id}`),
    create: (body: Record<string, unknown>) => http.post<SpaceDetail>('/admin/spaces', body),
    update: (id: number, body: Record<string, unknown>) =>
      http.patch<SpaceDetail>(`/admin/spaces/${id}`, body),
    remove: (id: number) => http.delete(`/admin/spaces/${id}`),
  },
  /** UC-ADM-17: mô hình 3D đặt trong ảnh 360° (:id là id ảnh 360°) */
  placements: {
    list: (panoramaId: number) => http.get<PlacementView[]>(`/admin/panoramas/${panoramaId}/placements`),
    create: (panoramaId: number, body: Record<string, unknown>) =>
      http.post<PlacementView>(`/admin/panoramas/${panoramaId}/placements`, body),
    update: (panoramaId: number, id: number, body: Record<string, unknown>) =>
      http.patch<PlacementView>(`/admin/panoramas/${panoramaId}/placements/${id}`, body),
    remove: (panoramaId: number, id: number) =>
      http.delete(`/admin/panoramas/${panoramaId}/placements/${id}`),
  },
  settings: {
    get: () => http.get<StoreSettings>('/admin/settings'),
    save: (body: Partial<StoreSettings>) => http.put<StoreSettings>('/admin/settings/store', body),
    resetMock: () => http.post<null>('/admin/settings/reset-mock'), // chỉ có ở mock
  },
  inventory: {
    rows: (q: Query) => http.list<InventoryRow>('/admin/inventory', q),
    summary: () =>
      http.get<{ totalStock: number; stockValue: number; lowCount: number; outCount: number }>(
        '/admin/inventory/summary',
      ),
  },
  /** UC-ADM-27: nhật ký hoạt động (chỉ đọc) */
  activityLogs: {
    list: (q: Query) => http.list<ActivityLogRow>('/admin/activity-logs', q),
    options: () => http.get<ActivityLogOptions>('/admin/activity-logs/options'),
  },
  /** UC-ADM-02: vai trò và quyền (chỉ đọc) */
  roles: { list: () => http.get<RoleView[]>('/admin/roles') },
  /** UC-ADM-26: gửi thông báo cho người dùng (adminApi.notifications là chuông thông báo của admin) */
  notify: {
    send: (body: {
      title: string;
      content: string;
      type?: 'system' | 'promo';
      link?: string;
      userIds?: number[];
      all?: boolean;
    }) => http.post<{ sent: number }>('/admin/notifications', body),
  },
  media: {
    list: (q: Query) => http.list<MediaAdmin>('/admin/media', q),
    /** Máy chủ thật: multipart (một tệp một lần); dữ liệu giả: data-URL */
    upload: async (file: File) => {
      if (USE_MOCK) {
        const fileData = await readAsDataUrl(file);
        return http.post<MediaAdmin>('/admin/media', {
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileData,
        });
      }
      const form = new FormData();
      form.append('file', file);
      return http.post<MediaAdmin>('/admin/media', form);
    },
    update: (id: number, body: { altText: string }) => http.patch<MediaAdmin>(`/admin/media/${id}`, body),
    remove: (id: number) => http.delete<{ id: number }>(`/admin/media/${id}`),
  },
  attributes: {
    list: () => http.get<AttributeAdmin[]>('/admin/attributes'),
    addValue: (id: number, body: { value: string; colorHex?: string }) =>
      http.post<AttributeValueAdmin>(`/admin/attributes/${id}/values`, body),
    updateValue: (id: number, valueId: number, body: { value?: string; colorHex?: string }) =>
      http.patch<AttributeValueAdmin>(`/admin/attributes/${id}/values/${valueId}`, body),
    removeValue: (id: number, valueId: number) =>
      http.delete<{ id: number }>(`/admin/attributes/${id}/values/${valueId}`),
  },
  notifications: () =>
    http.get<Array<{ id: number; text: string; createdAt: string; link: string }>>('/admin/notifications'),
  search: (q: string) =>
    http.get<Array<{ type: 'product' | 'order' | 'customer'; label: string; href: string }>>(
      '/admin/search',
      { q },
    ),
};
