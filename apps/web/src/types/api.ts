// Kiểu dữ liệu mà API trả về cho giao diện = entity khớp 100% schema.prisma (shared-types) + quan hệ mở rộng.
// Trường/bảng CHƯA có ở BE hoặc DB được đánh dấu "TODO: chưa có trong BE/DB".
import type {
  ActivityLog,
  Address,
  Category,
  Coupon,
  Notification,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  Product,
  Product3DModel,
  ModelFile,
  ProductVariant,
  Review,
  RoleCode,
  Shipment,
  Space,
  SpaceHotspot,
  SpacePanorama,
  SpaceProductPlacement,
  User,
  CartItem,
  Media,
  OrderPaymentStatus,
} from '@aurelia-living/shared-types';

export type {
  ActivityLog,
  Address,
  Category,
  Coupon,
  Notification,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  Product,
  Product3DModel,
  ModelFile,
  ProductVariant,
  Review,
  Shipment,
  Space,
  SpaceHotspot,
  SpacePanorama,
  SpaceProductPlacement,
  User,
  Media,
};

export interface ColorOption {
  name: string;
  hex: string;
}

// ---------- Danh mục ----------
export interface CategoryNode extends Category {
  imageUrl: string | null;
  productCount: number;
  parentName: string | null;
  children: CategoryNode[];
  description?: string | null;
  isFeatured?: boolean;
}

// ---------- Sản phẩm ----------
export interface ProductListItem extends Product {
  /** Giá niêm yết của biến thể mặc định (ProductVariant.price) */
  price: number;
  /** Giá khuyến mãi (ProductVariant.salePrice) – null nếu không giảm */
  salePrice: number | null;
  /** Tổng tồn kho các biến thể (Σ stockQuantity) */
  stockQuantity: number;
  defaultVariantId: number;
  thumbnailUrl: string | null;
  category: { id: number; name: string; slug: string } | null;
  brand: string | null;
  colors: ColorOption[];
  sizes: string[];
  material: string | null; // thuộc tính "material" của biến thể
  style: string | null;
  sku: string;
  isWishlisted: boolean;
}

export interface VariantView extends ProductVariant {
  color: ColorOption | null;
  size: string | null;
  material: string | null;
  imageUrl: string | null;
}

export interface ProductImageView {
  id: number;
  /** id bản ghi media (ổn định); gửi lại khi lưu sản phẩm để giữ nguyên ảnh và liên kết biến thể */
  mediaId?: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  variantId: number | null;
}

export interface ModelFileView extends ModelFile {
  url: string;
  fileName: string;
  fileSize: number;
}

/** POST /admin/models, /upload và /:id/reprocess trả 202 */
export interface ModelProcessingAccepted {
  modelId: number;
  jobId: string;
  status: 'processing';
}

/** UC-ADM-14: cấu hình vật liệu áp lên vật liệu `materialName` của GLB khi khách chọn biến thể `variantId` (UC-3D-03) */
export interface MaterialConfig {
  baseColor?: string;
  roughness?: number;
  metalness?: number;
}
export interface MaterialVariantView {
  variantId: number;
  materialName: string;
  config: MaterialConfig;
}

export interface AdminMaterialVariant extends MaterialVariantView {
  id: number;
  modelId: number;
  updatedAt: string;
}

export interface Model3DView extends Product3DModel {
  /** nguồn mô hình: tạo bằng AI hay admin tải lên (null: mô hình cũ không ghi) */
  source?: 'ai' | 'upload' | null;
  /** màu mà mô hình thể hiện (màu của ảnh đầu vào khi tạo bằng AI) */
  colorName?: string | null;
  files: ModelFileView[];
  materialVariants?: MaterialVariantView[];
  glbUrl: string | null;
  posterUrl: string | null;
}

export interface ProductDetail extends ProductListItem {
  images: ProductImageView[];
  variants: VariantView[];
  features: string[];
  model: Model3DView | null;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  breadcrumb: Array<{ label: string; href: string }>;
}

export interface ProductFacets {
  categories: Array<{ slug: string; name: string; count: number }>;
  colors: Array<ColorOption & { count: number }>;
  materials: Array<{ value: string; count: number }>;
  styles: Array<{ value: string; count: number }>;
}

// ---------- Đánh giá ----------
export interface ReviewView extends Review {
  userName: string;
  userAvatarUrl: string | null;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  variantLabel: string | null;
  orderCode: string | null;
  purchasedAt: string | null;
  tags: string[]; // chip tiêu chí
}

// ---------- Người dùng ----------
export interface UserView extends User {
  roles: RoleCode[];
  avatarUrl: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birthday: string | null;
  customerGroup: 'new' | 'loyal'; // suy ra từ số đơn/chi tiêu
  loyaltyPoints: number;
  adminNote: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AddressView extends Address {
  label: string; // "Nhà riêng", "Văn phòng"
}

// ---------- Thanh toán VNPAY ----------
/** GET /payments/vnpay/return-status: trang Return URL chỉ đọc */
export type VnpayReturnStatus =
  | { valid: false }
  | { valid: true; orderCode: string; responseCode: string; paymentStatus: OrderPaymentStatus };

// ---------- Giỏ hàng ----------
export interface CartItemView extends CartItem {
  productId: number;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  sku: string;
  variantLabel: string;
  unitPrice: number;
  originalPrice: number;
  lineTotal: number;
  stockQuantity: number;
}

export interface CartView {
  id: number;
  userId: number;
  items: CartItemView[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  coupon: { id: number; code: string; type: Coupon['type'] | 'freeship'; value: number } | null;
}

// ---------- Đơn hàng ----------
export interface OrderItemView extends OrderItem {
  imageUrl: string | null;
  productSlug: string | null;
  productId: number | null;
  variantLabel: string;
  reviewed: boolean;
}

export interface OrderHistoryView extends OrderStatusHistory {
  actorName: string; // "Admin" | "Hệ thống" | tên khách
}

export interface OrderView extends Order {
  items: OrderItemView[];
  itemCount: number;
  history: OrderHistoryView[];
  payment: Payment | null;
  shipment: Shipment | null;
  /** mọi vận đơn của đơn (cũ → mới); `shipment` là vận đơn hiện tại (mới nhất) */
  shipments: Shipment[];
  couponCode: string | null;
  customer: {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    totalOrders: number;
    customerGroup: 'new' | 'loyal';
  } | null;
  internalNote: string | null;
  deliveredAt: string | null;
}

// ---------- Coupon ----------
export interface CouponView extends Coupon {
  name: string;
  description: string | null;
  kind: 'percent' | 'fixed' | 'freeship'; // 'freeship' = coupon_type freeship (mã giảm phí vận chuyển)
}

/** GET /coupons/available: mã công khai khách còn dùng được, kèm tình trạng theo giỏ hiện tại */
export interface AvailableCoupon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: CouponView['kind'];
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  endsAt: string | null;
  /** null = mã không giới hạn lượt mỗi khách */
  remainingForUser: number | null;
  eligible: boolean;
  reason: string | null;
  estimatedDiscount: number;
  isApplied: boolean;
}

// ---------- Thông báo ----------
export interface NotificationData {
  type: 'order' | 'promo' | 'system';
  content: string;
  link: string | null;
}
export interface NotificationView extends Omit<Notification, 'data'> {
  data: NotificationData;
}

// ---------- Không gian mẫu ----------
export interface SpaceListItem extends Space {
  coverUrl: string | null;
  productCount: number;
  panoramaCount: number;
}

/** UC-ADM-17 / UC-SPACE-04: mô hình 3D rút gọn của một món đặt trong ảnh 360° (các LOD của GLB + vật liệu theo biến thể) */
export interface PlacementModel {
  id: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  files: Array<{ lod: 'high' | 'medium' | 'low' | null; url: string; fileSize: number }>;
  materialVariants: MaterialVariantView[];
}

/** Mô hình 3D đã đặt vào ảnh 360°: hướng (yaw, pitch độ), khoảng cách (m), xoay (độ), tỉ lệ */
export interface PlacementView {
  id: number;
  panoramaId: number;
  productId: number;
  variantId: number | null;
  modelId: number | null;
  yaw: number;
  pitch: number;
  distance: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
  product: { id: number; name: string; slug: string } | null;
  /** null = không có mô hình dùng được (client bỏ qua) */
  model: PlacementModel | null;
}

/** UC-SPACE-05 "Đổi món": sản phẩm cùng danh mục có mô hình ready */
export interface PlacementAlternative {
  id: number;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  thumbnailUrl: string | null;
  variantId: number | null;
  model: PlacementModel;
}

export interface PanoramaView extends SpacePanorama {
  url: string;
  hotspots: Array<
    SpaceHotspot & {
      product: Pick<
        ProductListItem,
        'id' | 'name' | 'slug' | 'price' | 'salePrice' | 'thumbnailUrl' | 'defaultVariantId'
      > | null;
    }
  >;
  placements: PlacementView[];
}

export interface SpaceDetail extends SpaceListItem {
  panoramas: PanoramaView[];
  products: ProductListItem[];
  originalTotal: number;
  comboTotal: number;
  comboDiscountPercent: number;
  similar: SpaceListItem[];
}

// ---------- Quản trị ----------
export interface DashboardStats {
  totalOrders: number;
  revenue: number;
  newCustomers: number;
  totalProducts: number;
  deltas: { orders: number; revenue: number; customers: number; products: number };
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  statusBreakdown: Array<{ status: Order['status']; count: number; percent: number }>;
  recentOrders: OrderView[];
  topProducts: Array<{
    productId: number;
    name: string;
    slug: string;
    imageUrl: string | null;
    sold: number;
    revenue: number;
  }>;
  recentActivity: Array<ActivityLog & { actorName: string; actorAvatarUrl: string | null; text: string }>;
}

export type ModelVariantKey = 'cleaned' | 'original';
export type ModelLodKey = 'high' | 'medium' | 'low';

export interface ModelNormalizeReport {
  floorRemoved: boolean;
  floorTriangles: number;
  autoYawDeg: number;
  manualYawDeg: number;
  scale: number;
  targetMm: { length: number; width: number; height: number };
  measuredMm: { length: number; width: number; height: number };
  deviationPct: { length: number; width: number; height: number };
  distorted: boolean;
  triangles: number;
  warnings: string[];
}

export interface ModelVariantInfo {
  report: ModelNormalizeReport;
  files: Record<
    ModelLodKey,
    { size: number; polygonCount: number | null; textureResolution: number | null; isCompressed: boolean }
  >;
}

/** GET /admin/models/:id – dữ liệu cho màn duyệt */
export interface ModelReviewDetail {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  status: Product3DModel['status'];
  isPrimary: boolean;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  source: 'ai' | 'upload' | null;
  stage: string | null;
  createdAt: string;
  fileName: string | null;
  rawBytes: number | null;
  space: string | null;
  colorName: string | null;
  generatedSeconds: number | null;
  sourceImageUrl: string | null;
  options: { removeFloor: boolean; yawDeg: number };
  defaultVariant: ModelVariantKey | null;
  chosenVariant: ModelVariantKey | null;
  normalization: ModelNormalizeReport | null;
  variants: Partial<Record<ModelVariantKey, ModelVariantInfo>>;
  error: { message: string; kind?: string; raw?: string; at: string } | null;
  /** chỉ dữ liệu giả: tệp người dùng chọn để xem thử */
  mockPreviewUrl?: string;
}

/** GET /admin/models/ai/status */
export interface Ai3dStatus {
  enabled: boolean;
  /** lý do tính năng đang tắt */
  reason: string | null;
  provider: string;
  spaces: Array<{ id: string; label: string; role: 'primary' | 'fallback'; note: string }>;
  usage: { usedLastHour: number; perHour: number; usedToday: number; perDay: number };
  limitReached: string | null;
  lastError: { at: string; message: string; raw: string; space: string | null } | null;
}

export interface Ai3dRequest {
  productId: number;
  imageId?: number;
  space?: string;
  removeFloor?: boolean;
  /** xác nhận gửi ảnh cho bên thứ ba */
  consent: true;
}

export interface Model3DAdminRow extends Model3DView {
  stage?: string | null;
  space?: string | null;
  sizeBytes?: number;
  /** id MÔ HÌNH (id dòng `id` = id tệp, hoặc -modelId khi mô hình chưa có tệp) */
  modelId: number;
  /** null khi mô hình chưa có tệp (đang xử lý hoặc lỗi) */
  fileId: number | null;
  /** lý do lỗi khi status = failed (máy chủ thật) */
  failureReason: string | null;
  lod: 'high' | 'medium' | 'low' | null;
  productName: string;
  productThumbnailUrl: string | null;
  format: 'glb';
  fileName: string;
  sizeMB: number;
  uploadedAt: string;
}

export interface InventoryRow {
  variantId: number;
  productId: number;
  productName: string;
  imageUrl: string | null;
  sku: string;
  categoryName: string;
  costPrice: number;
  stockQuantity: number;
  available: number;
  minStock: number;
  state: 'in_stock' | 'low' | 'out';
}

/** Thuộc tính và giá trị ở trang quản trị (GET /admin/attributes) */
export interface AttributeValueAdmin {
  id: number;
  attributeId: number;
  value: string;
  colorHex: string | null;
  usageCount: number;
}
export interface AttributeAdmin {
  id: number;
  code: string;
  name: string;
  isSystem: boolean;
  values: AttributeValueAdmin[];
}

/** Tệp trong thư viện media (GET /admin/media) */
export interface MediaAdmin {
  id: number;
  fileName: string;
  url: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  uploadedByName: string | null;
  createdAt: string;
  /** required: chặn xóa (409); optional: chỉ bị gỡ liên kết khi xóa */
  usage: { required: number; optional: number };
}

/** Kết quả tạo/cập nhật vận đơn (POST /admin/orders/:id/shipments, PATCH /admin/shipments/:id) */
export interface ShipmentResult {
  shipment: Shipment;
  order: OrderView;
  /** cảnh báo không chặn, ví dụ mã vận đơn trùng đơn vị khác */
  warnings: string[];
}

export interface ShippingZone {
  id: number;
  name: string;
  fee: number;
  freeFrom: number;
  eta: string;
}

export interface StoreSettings {
  store: {
    name: string;
    slogan: string;
    email: string;
    hotline: string;
    address: string;
    taxCode: string;
    logoUrl: string | null;
  };
  payments: Array<{
    method: 'cod' | 'bank_transfer' | 'vnpay' | 'momo' | 'zalopay';
    enabled: boolean;
    description: string;
  }>;
  shippingZones: ShippingZone[];
}

export interface FinanceReport {
  totalIncome: number;
  deltas: { income: number };
  monthly: Array<{ month: string; income: number }>;
  byPaymentMethod: Array<{ method: string; amount: number; percent: number }>;
  byCategory: Array<{ name: string; amount: number; percent: number }>;
  daily: Array<{ date: string; revenue: number }>;
  income: { gross: number; discount: number; net: number };
  ledger: Array<{
    date: string;
    code: string;
    content: string;
    type: 'income';
    category: string;
    amount: number;
  }>;
  topProducts: DashboardStats['topProducts'];
}

// ---------- Mở rộng nhẹ: nhật ký hoạt động, vai trò, phiên đăng nhập ----------
/** UC-ADM-27: một dòng activity_logs; `auto` = do ActivityLogInterceptor ghi (service không ghi log) */
export interface ActivityLogRow {
  id: number;
  actorId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
  auto: boolean;
}
export interface ActivityLogOptions {
  actors: Array<{ id: number; fullName: string; email: string }>;
  actions: string[];
  targetTypes: string[];
}
/** UC-ADM-02: vai trò kèm quyền (chỉ 2 vai trò: admin, user) */
export interface RoleView {
  id: number;
  code: 'admin' | 'user';
  name: string;
  description: string | null;
  userCount: number;
  permissions: Array<{ code: string; name: string; description: string | null }>;
}
/** UC-ACC-03: phiên đăng nhập còn hiệu lực của chính người dùng */
export interface SessionView {
  id: number;
  deviceName: string;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}
