// Kiểu dữ liệu mà API trả về cho giao diện = entity khớp 100% schema.prisma (shared-types) + quan hệ mở rộng.
// Trường nào KHÔNG có trong DB được đánh dấu "TODO: chưa có trong DB" (xem docs/PROJECT_ANALYSIS.md mục 7).
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
  InventoryMovement,
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
  InventoryMovement,
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
  description?: string | null; // TODO: chưa có trong DB
  isFeatured?: boolean; // TODO: chưa có trong DB
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
  brand: { id: number; name: string } | null;
  colors: ColorOption[];
  sizes: string[];
  material: string | null; // thuộc tính "material" của biến thể
  style: string | null; // TODO: chưa có trong DB
  sku: string;
  isWishlisted: boolean;
  /** Sản phẩm có ảnh xoay 360° – TODO: cần thêm vào DB/API */
  has360: boolean;
}

export interface VariantView extends ProductVariant {
  color: ColorOption | null;
  size: string | null;
  material: string | null;
  imageUrl: string | null;
}

export interface ProductImageView {
  id: number;
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
  files: ModelFileView[];
  materialVariants?: MaterialVariantView[];
  glbUrl: string | null;
  posterUrl: string | null;
}

export interface ProductDetail extends ProductListItem {
  images: ProductImageView[];
  variants: VariantView[];
  specs: Array<{ label: string; value: string }>; // TODO: chưa có trong DB (dựng từ thuộc tính + kích thước mô hình)
  features: string[]; // TODO: chưa có trong DB
  model: Model3DView | null;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  questionCount: number;
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
  images: string[]; // TODO: chưa có trong DB
  tags: string[]; // TODO: chưa có trong DB (chip tiêu chí)
}

// ---------- Người dùng ----------
export interface UserView extends User {
  roles: RoleCode[];
  avatarUrl: string | null;
  gender: 'male' | 'female' | 'other' | null; // TODO: chưa có trong DB
  birthday: string | null; // TODO: chưa có trong DB
  customerGroup: 'new' | 'loyal'; // TODO: chưa có trong DB (suy ra từ số đơn/chi tiêu)
  loyaltyPoints: number; // TODO: chưa có trong DB
  adminNote: string | null; // TODO: chưa có trong DB
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AddressView extends Address {
  label: string; // TODO: chưa có trong DB ("Nhà riêng", "Văn phòng")
}

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
  internalNote: string | null; // TODO: chưa có trong DB
  deliveredAt: string | null;
  canReturnUntil: string | null;
}

// ---------- Coupon ----------
export interface CouponView extends Coupon {
  name: string; // TODO: chưa có trong DB
  description: string | null; // TODO: chưa có trong DB
  appliesTo: 'all' | 'category' | 'product' | 'space'; // TODO: chưa có trong DB
  appliesToLabel: string; // TODO: chưa có trong DB
  kind: 'percent' | 'fixed' | 'freeship'; // 'freeship' TODO: CouponType DB chỉ có percent|fixed
}

export interface UserCouponView {
  id: number;
  couponId: number;
  userId: number;
  status: 'unused' | 'used' | 'expired'; // TODO: chưa có bảng user_coupons
  savedAt: string;
  coupon: CouponView;
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
  isBookmarked: boolean;
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

export interface Model3DAdminRow extends Model3DView {
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

// ---------- Thực thể CHƯA có trong DB (mock tự đặt tên theo WIREFRAME.md mục 5) ----------
export type ReturnStatus = 'pending' | 'picking' | 'inspecting' | 'refunded' | 'exchanged' | 'rejected';
export interface ReturnRequest {
  // TODO: chưa có trong DB
  id: number;
  code: string; // "RT0012"
  orderId: number;
  orderCode: string;
  userId: number;
  customerName: string;
  items: Array<{
    productId: number;
    productName: string;
    imageUrl: string | null;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
  }>;
  type: 'refund' | 'exchange';
  reason: 'defect' | 'wrong_item' | 'not_as_described' | 'missing_accessory' | 'change_mind';
  description: string;
  images: string[];
  refundAmount: number;
  status: ReturnStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductQuestion {
  // TODO: chưa có trong DB
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  userId: number;
  userName: string;
  content: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  isPublic: boolean;
  status: 'unanswered' | 'answered' | 'hidden';
  createdAt: string;
}

export interface Banner {
  // TODO: chưa có trong DB
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string;
  position: 'hero-1' | 'hero-2' | 'hero-3' | 'home-left' | 'home-right' | 'home-3d';
  startAt: string;
  endAt: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Post {
  // TODO: chưa có trong DB
  id: number;
  title: string;
  slug: string;
  category: string;
  coverUrl: string;
  content: string;
  authorName: string;
  status: 'published' | 'draft';
  views: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface Supplier {
  // TODO: chưa có trong DB
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface StockReceipt {
  // TODO: chưa có trong DB
  id: number;
  code: string; // "PN0012" | "PX0012"
  type: 'in' | 'out';
  /** chỉ còn trong dữ liệu mock gốc; API thật không trả (nhà cung cấp là chữ trong phiếu) */
  supplierId?: number | null;
  supplierName: string | null;
  orderCode: string | null;
  itemCount: number;
  total: number;
  status: 'draft' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface InventoryRow {
  variantId: number;
  productId: number;
  productName: string;
  imageUrl: string | null;
  sku: string;
  categoryName: string;
  costPrice: number; // TODO: chưa có trong DB
  stockQuantity: number;
  available: number;
  minStock: number; // TODO: chưa có trong DB
  state: 'in_stock' | 'low' | 'out';
}

/** Một dòng lịch sử biến động tồn kho (GET /admin/inventory/movements) */
export interface StockMovement {
  id: number;
  variantId: number;
  sku: string;
  productName: string;
  type: 'import' | 'sale' | 'return' | 'adjustment';
  quantityChange: number;
  reason: string | null;
  referenceCode: string | null;
  performedByName: string;
  createdAt: string;
}

/** Thương hiệu ở trang quản trị (GET /admin/brands) */
export interface BrandAdmin {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  productCount: number;
}

/** Thuộc tính và giá trị ở trang quản trị (GET /admin/attributes) */
export interface AttributeValueAdmin {
  id: number;
  attributeId: number;
  value: string;
  colorHex: string | null;
  usageCount: number;
  frameCount: number;
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

export interface Expense {
  // TODO: chưa có trong DB
  id: number;
  code: string; // "CH-0001"
  category: 'cogs' | 'shipping' | 'marketing' | 'payment_fee' | 'refund' | 'other';
  amount: number;
  note: string;
  date: string;
}

export interface ContactMessage {
  // TODO: chưa có trong DB
  id: number;
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  content: string;
  createdAt: string;
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
  totalExpense: number;
  profit: number;
  margin: number;
  deltas: { income: number; expense: number; profit: number; margin: number };
  monthly: Array<{ month: string; income: number; expense: number; profit: number }>;
  expenseBreakdown: Array<{ category: Expense['category']; label: string; amount: number; percent: number }>;
  byPaymentMethod: Array<{ method: string; amount: number; percent: number }>;
  byCategory: Array<{ name: string; amount: number; percent: number }>;
  daily: Array<{ date: string; revenue: number }>;
  income: {
    gross: number;
    discountAndRefund: number;
    net: number;
    cogs: number;
    grossProfit: number;
    opex: number;
    profitBeforeTax: number;
  };
  ledger: Array<{
    date: string;
    code: string;
    content: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
  }>;
  topProducts: DashboardStats['topProducts'];
}

// ---------- Xem 360° (TODO: cần thêm vào DB/API) ----------
export interface Product360Color {
  colorId: number;
  name: string;
  hex: string;
  thumbnail: string;
  /** URL ảnh theo thứ tự góc 0° → 350° */
  frames: string[];
}

export interface Product360Variant extends VariantView {
  dimensionsCm: { length: number; width: number; height: number };
  weightKg: number | null;
}

export interface PolicyItem {
  key: 'shipping' | 'returns' | 'warranty' | 'payment';
  title: string;
  summary: string;
  href: string;
}

export interface Product360Data {
  productId: number;
  slug: string;
  enabled: boolean;
  frameCount: number;
  defaultColor: string;
  autoRotate: boolean;
  rotationSpeed: number;
  colors: Product360Color[];
  variants: Product360Variant[];
  product: ProductDetail;
  policies: PolicyItem[];
}

export interface Product360AdminData {
  enabled: boolean;
  frameCount: number;
  autoRotate: boolean;
  colors: Array<{ name: string; hex: string; frames: string[] }>;
  variantColors: ColorOption[];
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

/** UC-ADM-29 (không gian mẫu): phễu người xem → bấm hotspot → thêm giỏ; người dùng và khách gộp theo visitorId */
export interface SpaceFunnelStage {
  /** số lượt xem (mỗi lần mở không gian) */
  views: number;
  /** số người xem (đã gộp theo visitorId) */
  viewers: number;
  clicked: number;
  carted: number;
  /** clicked / viewers, cartRate = carted / viewers, clickToCartRate = (bấm và thêm giỏ) / clicked; 0 khi mẫu số = 0 */
  clickRate: number;
  cartRate: number;
  clickToCartRate: number;
}
export interface SpaceFunnelSource {
  productId: number;
  name: string;
  slug: string | null;
  views: number;
  viewers: number;
}
export interface SpaceFunnel {
  from: string;
  to: string;
  totals: SpaceFunnelStage;
  spaces: Array<
    SpaceFunnelStage & { spaceId: number; title: string; slug: string | null; sources: SpaceFunnelSource[] }
  >;
  sources: Array<SpaceFunnelSource & { spaces: number }>;
}
