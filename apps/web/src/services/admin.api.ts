// Service gọi API khu vực quản trị (/api/admin/*) – chỉ tài khoản role 'admin' (Doanh nghiệp)
import type { Coupon, OrderStatus, ReviewStatus } from '@aurelia-living/shared-types';
import type {
  Banner,
  CategoryNode,
  CouponView,
  DashboardStats,
  Expense,
  FinanceReport,
  InventoryRow,
  Model3DAdminRow,
  OrderView,
  Post,
  Product360AdminData,
  ProductDetail,
  ProductListItem,
  ProductQuestion,
  ReturnRequest,
  ReviewView,
  SpaceDetail,
  SpaceListItem,
  StockReceipt,
  StoreSettings,
  AttributeAdmin,
  ModelProcessingAccepted,
  ShipmentResult,
  MediaAdmin,
  AttributeValueAdmin,
  BrandAdmin,
  StockMovement,
  UserView,
} from '@/types/api';
import { readAsDataUrl } from '@/components/admin/UploadDropzone';
import type { PresignedUpload } from '@aurelia-living/shared-types';
import { USE_MOCK, http, type Query } from './api-client';
import { getUploadMode, putToStorage } from './direct-upload';

export const adminApi = {
  stats: (q: { from?: string; to?: string }) => http.get<DashboardStats>('/admin/stats/overview', q),
  finance: (q: { from?: string; to?: string }) => http.get<FinanceReport>('/admin/stats/finance', q),

  products: {
    list: (q: Query) => http.list<ProductListItem>('/admin/products', q),
    get: (id: number) => http.get<ProductDetail>(`/admin/products/${id}`),
    create: (body: Record<string, unknown>) => http.post<ProductDetail>('/admin/products', body),
    update: (id: number, body: Record<string, unknown>) =>
      http.patch<ProductDetail>(`/admin/products/${id}`, body),
    remove: (id: number) => http.delete(`/admin/products/${id}`),
    /** Ảnh 360° – TODO: chưa có trong BE */
    get360: (id: number) => http.get<Product360AdminData>(`/admin/products/${id}/360`),
    save360: (
      id: number,
      body: { enabled: boolean; autoRotate: boolean; colors: Product360AdminData['colors'] },
    ) => http.put<Product360AdminData>(`/admin/products/${id}/360`, body),
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
    counts: () => http.get<Record<string, number>>('/admin/orders/counts'), // TODO: chưa có trong BE
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
    confirmPayment: (id: number) => http.patch<OrderView>(`/admin/payments/${id}/confirm`),
    saveNote: (id: number, note: string) => http.patch<OrderView>(`/admin/orders/${id}/note`, { note }), // TODO: chưa có trong BE
  },
  returns: {
    list: (q: Query) => http.list<ReturnRequest>('/admin/returns', q), // TODO: chưa có trong BE
    update: (id: number, body: { status: ReturnRequest['status']; adminNote?: string }) =>
      http.patch<ReturnRequest>(`/admin/returns/${id}`, body),
  },
  customers: {
    list: (q: Query) => http.list<UserView>('/admin/users', q),
    get: (id: number) =>
      http.get<
        UserView & { addresses: unknown[]; recentActivity: Array<{ text: string; createdAt: string }> }
      >(`/admin/users/${id}`),
    setStatus: (id: number, status: 'active' | 'suspended') =>
      http.patch<UserView>(`/admin/users/${id}/status`, { status }),
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
  questions: {
    list: (q: Query) => http.list<ProductQuestion>('/admin/questions', q), // TODO: chưa có trong BE
    answer: (id: number, body: { answer: string; isPublic: boolean }) =>
      http.patch<ProductQuestion>(`/admin/questions/${id}`, body),
    hide: (id: number) => http.patch<ProductQuestion>(`/admin/questions/${id}`, { status: 'hidden' }),
  },
  models: {
    list: (q: Query) => http.list<Model3DAdminRow>('/admin/models', q),
    /** Máy chủ thật: multipart ⇒ 202 (xử lý nền, trạng thái processing); dữ liệu giả: JSON metadata */
    upload: async (
      file: File,
      meta: {
        productId: number;
        format: 'glb';
        scale: number;
        unit: string;
        createNew?: boolean;
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
          scale: meta.scale,
        });
      }
      // Kho MinIO/S3 (UC-ADM-13 bước 4–5): presign ⇒ PUT thẳng lên bucket PRIVATE ⇒ confirm (202, xử lý nền)
      if ((await getUploadMode()) === 'presigned') {
        const p = await http.post<PresignedUpload & { modelId: number }>('/admin/models/presign', {
          productId: meta.productId,
          fileName: file.name,
          size: file.size,
          format: meta.format,
          scale: meta.scale,
          unit: meta.unit,
          createNew: meta.createNew ?? false,
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
      form.append('scale', String(meta.scale));
      form.append('unit', meta.unit);
      if (meta.createNew) form.append('createNew', 'true');
      return http.post<ModelProcessingAccepted>('/admin/models/upload', form);
    },
    /** Xóa một tệp (dòng có fileId) */
    remove: (id: number) => http.delete(`/admin/models/${id}`),
    /** Xóa cả mô hình chưa có tệp (đang xử lý / lỗi) */
    removeModel: (modelId: number) => http.delete(`/admin/models/model/${modelId}`),
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
  content: {
    banners: () => http.get<Banner[]>('/admin/banners'), // TODO: chưa có trong BE
    saveBanner: (body: Partial<Banner>) =>
      body.id
        ? http.patch<Banner>(`/admin/banners/${body.id}`, body)
        : http.post<Banner>('/admin/banners', body),
    removeBanner: (id: number) => http.delete(`/admin/banners/${id}`),
    posts: () => http.get<Post[]>('/admin/posts'), // TODO: chưa có trong BE
    savePost: (body: Partial<Post>) =>
      body.id ? http.patch<Post>(`/admin/posts/${body.id}`, body) : http.post<Post>('/admin/posts', body),
    removePost: (id: number) => http.delete(`/admin/posts/${id}`),
    pages: () =>
      http.get<
        Array<{
          id: number;
          slug: string;
          title: string;
          content: string | null;
          status: string;
          updatedAt: string;
        }>
      >('/admin/pages'),
    savePage: (id: number, body: { title?: string; content?: string; status?: string }) =>
      http.patch(`/admin/pages/${id}`, body),
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
    receipts: () => http.get<StockReceipt[]>('/admin/inventory/receipts'),
    createReceipt: (body: {
      type: 'in' | 'out';
      supplierName?: string;
      status?: 'draft' | 'completed';
      items: Array<{ variantId: number; quantity: number; costPrice: number }>;
    }) => http.post<StockReceipt>('/admin/inventory/receipts', body),
    confirmReceipt: (id: number) => http.post<StockReceipt>(`/admin/inventory/receipts/${id}/confirm`),
    cancelReceipt: (id: number) => http.post<StockReceipt>(`/admin/inventory/receipts/${id}/cancel`),
    movements: (q: Query) => http.list<StockMovement>('/admin/inventory/movements', q),
  },
  expenses: {
    create: (body: Omit<Expense, 'id' | 'code'>) => http.post<Expense>('/admin/expenses', body),
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
    create: (body: { code: string; name: string }) => http.post<AttributeAdmin>('/admin/attributes', body),
    update: (id: number, body: { code?: string; name?: string }) =>
      http.patch<AttributeAdmin>(`/admin/attributes/${id}`, body),
    remove: (id: number) => http.delete<{ id: number }>(`/admin/attributes/${id}`),
    addValue: (id: number, body: { value: string; colorHex?: string }) =>
      http.post<AttributeValueAdmin>(`/admin/attributes/${id}/values`, body),
    updateValue: (id: number, valueId: number, body: { value?: string; colorHex?: string }) =>
      http.patch<AttributeValueAdmin>(`/admin/attributes/${id}/values/${valueId}`, body),
    removeValue: (id: number, valueId: number) =>
      http.delete<{ id: number }>(`/admin/attributes/${id}/values/${valueId}`),
  },
  brands: {
    list: (q: Query) => http.get<BrandAdmin[]>('/admin/brands', q),
    create: (body: Record<string, unknown>) => http.post<BrandAdmin>('/admin/brands', body),
    update: (id: number, body: Record<string, unknown>) =>
      http.patch<BrandAdmin>(`/admin/brands/${id}`, body),
    remove: (id: number) => http.delete<{ id: number; productsDetached: number }>(`/admin/brands/${id}`),
  },
  notifications: () =>
    http.get<Array<{ id: number; text: string; createdAt: string; link: string }>>('/admin/notifications'),
  search: (q: string) =>
    http.get<Array<{ type: 'product' | 'order' | 'customer'; label: string; href: string }>>(
      '/admin/search',
      { q },
    ), // TODO: chưa có trong BE
};
