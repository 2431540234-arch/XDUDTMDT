// FILE SINH TỰ ĐỘNG từ apps/api/prisma/schema.prisma bằng scripts/generate-shared-types.mjs
// KHÔNG SỬA TAY. Sửa schema.prisma rồi chạy: npm run types:generate

import type { ArMode, BannerPosition, ContentStatus, CouponType, ExpenseCategory, HotspotType, InventoryMovementType, ModelFileFormat, ModelLod, ModelPlacement, ModelStatus, OrderPaymentStatus, OrderStatus, PaymentMethod, PaymentTxnStatus, QuestionStatus, ReturnReason, ReturnStatus, ReturnType, ReviewStatus, RoomType, ShipmentCarrier, ShipmentStatus, StockReceiptStatus, StockReceiptType, UserStatus } from './enums.generated';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ActivityLog {
  id: number;
  actorId: number | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  changes: JsonValue | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface Address {
  id: number;
  userId: number;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  addressLine: string;
  isDefault: boolean;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArSession {
  id: number;
  uuid: string;
  userId: number | null;
  visitorId: string | null;
  productId: number;
  modelId: number | null;
  device: string | null;
  os: string | null;
  arPlatform: string | null;
  mode: ArMode;
  durationSeconds: number;
  placed: boolean;
  captured: boolean;
  addedToCart: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArSnapshot {
  id: number;
  userId: number;
  productId: number;
  arSessionId: number | null;
  mediaId: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeValue {
  id: number;
  attributeId: number;
  value: string;
  colorHex?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attribute {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logoMediaId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: number;
  cartId: number;
  variantId: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: number;
  userId: number;
  couponId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  imageMediaId: number | null;
  sortOrder: number;
  isActive: boolean;
  description?: string | null;
  isFeatured?: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CouponUsage {
  id: number;
  couponId: number;
  userId: number;
  orderId: number;
  createdAt: string;
}

export interface Coupon {
  id: number;
  code: string;
  name?: string | null;
  description?: string | null;
  appliesTo?: string;
  appliesToLabel?: string | null;
  type: CouponType;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: number;
  variantId: number;
  type: InventoryMovementType;
  quantityChange: number;
  reason: string | null;
  referenceCode: string | null;
  performedBy: number | null;
  createdAt: string;
}

export interface Media {
  id: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  uploadedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelFile {
  id: number;
  modelId: number;
  format: ModelFileFormat;
  lod: ModelLod;
  mediaId: number;
  polygonCount: number | null;
  textureResolution: number | null;
  isCompressed: boolean;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelMaterialVariant {
  id: number;
  modelId: number;
  variantId: number;
  materialName: string;
  config: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  data: JsonValue;
  readAt: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  variantId: number | null;
  productName: string;
  sku: string;
  variantLabel?: string | null;
  imageMediaId?: number | null;
  costPrice?: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number | null;
  createdAt: string;
}

export interface OrderStatusHistory {
  id: number;
  orderId: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: number | null;
  note: string | null;
  createdAt: string;
}

export interface Order {
  id: number;
  uuid: string;
  orderCode: string;
  userId: number;
  status: OrderStatus;
  recipientName: string;
  recipientPhone: string;
  shippingProvince: string;
  shippingDistrict: string;
  shippingWard: string;
  shippingAddress: string;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  couponId: number | null;
  paymentMethod: PaymentMethod;
  paymentStatus: OrderPaymentStatus;
  note: string | null;
  cancelReason: string | null;
  internalNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: number;
  title: string;
  slug: string;
  type?: string;
  content: string | null;
  status: ContentStatus;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordReset {
  id: number;
  userId: number;
  expiresAt: string;
  usedAt: string | null;
  otpHash?: string | null;
  attempts?: number;
  lastSentAt?: string | null;
  createdAt: string;
}

export interface Payment {
  id: number;
  orderId: number;
  method: PaymentMethod;
  amount: number;
  status: PaymentTxnStatus;
  transactionCode: string | null;
  gatewayResponse: JsonValue | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Product3DModel {
  id: number;
  uuid: string;
  productId: number;
  variantId: number | null;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  placement: ModelPlacement;
  allowScaling: boolean;
  viewerConfig: JsonValue;
  posterMediaId: number | null;
  status: ModelStatus;
  version: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: number;
  productId: number;
  variantId: number | null;
  mediaId: number;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  price: number;
  salePrice: number | null;
  stockQuantity: number;
  weightGram: number | null;
  costPrice?: number;
  minStock?: number;
  reservedQuantity?: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  categoryId: number | null;
  brandId: number | null;
  status: ContentStatus;
  isFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  has3dModel: boolean;
  hasAr: boolean;
  style?: string | null;
  features?: JsonValue;
  metaTitle: string | null;
  metaDescription: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: number;
  userId: number;
  productId: number;
  orderId: number | null;
  rating: number;
  content: string | null;
  tags?: string[];
  isAnonymous?: boolean;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  roleId: number;
  permissionId: number;
  createdAt: string;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  id: number;
  key: string;
  value: JsonValue;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Shipment {
  id: number;
  orderId: number;
  carrier: ShipmentCarrier;
  trackingCode: string | null;
  status: ShipmentStatus;
  fee: number;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceBookmark {
  id: number;
  userId: number;
  spaceId: number;
  createdAt: string;
}

export interface SpaceHotspot {
  id: number;
  panoramaId: number;
  type: HotspotType;
  yaw: number;
  pitch: number;
  productId: number | null;
  targetPanoramaId: number | null;
  title: string | null;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpacePanorama {
  id: number;
  spaceId: number;
  mediaId: number;
  title: string | null;
  defaultYaw: number;
  defaultPitch: number;
  defaultFov: number;
  sortOrder: number;
  isStart: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceProductPlacement {
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
  createdAt: string;
  updatedAt: string;
}

export interface SpaceView {
  id: number;
  spaceId: number;
  userId: number | null;
  visitorId: string | null;
  sourceProductId: number | null;
  hotspotClickCount: number;
  addedToCart: boolean;
  createdAt: string;
}

export interface Space {
  id: number;
  uuid: string;
  title: string;
  slug: string;
  description: string | null;
  roomType: RoomType;
  style: string | null;
  categoryId: number | null;
  coverMediaId: number | null;
  status: ContentStatus;
  viewCount: number;
  comboDiscountPercent?: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  userId: number;
  roleId: number;
  createdAt: string;
}

export interface UserSession {
  id: number;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface User {
  id: number;
  uuid: string;
  fullName: string;
  email: string;
  phone: string | null;
  gender?: string | null;
  birthday?: string | null;
  loyaltyPoints?: number;
  adminNote?: string | null;
  avatarMediaId: number | null;
  status: UserStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VariantAttributeValue {
  variantId: number;
  attributeValueId: number;
  attributeId: number;
  createdAt: string;
}

export interface Wishlist {
  id: number;
  userId: number;
  productId: number;
  createdAt: string;
}

export interface ProductSpec {
  id: number;
  productId: number;
  label: string;
  value: string;
  sortOrder: number;
}

export interface Product360Config {
  id: number;
  productId: number;
  enabled: boolean;
  autoRotate: boolean;
  rotationSpeed: number;
  defaultColorId?: number | null;
  frameCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product360Frame {
  id: number;
  configId: number;
  attributeValueId: number;
  frameIndex: number;
  mediaId: number;
}

export interface ReviewImage {
  id: number;
  reviewId: number;
  mediaId: number;
  sortOrder: number;
}

export interface ProductQuestion {
  id: number;
  productId: number;
  userId: number;
  content: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  isPublic: boolean;
  status: QuestionStatus;
  createdAt: string;
}

export interface CouponScope {
  id: number;
  couponId: number;
  targetType: string;
  targetId: number;
}

export interface UserCoupon {
  id: number;
  userId: number;
  couponId: number;
  savedAt: string;
}

export interface CodeCounter {
  key: string;
  value: string;
}

export interface ReturnRequest {
  id: number;
  code: string;
  orderId: number;
  userId: number;
  type: ReturnType;
  reason: ReturnReason;
  description: string;
  status: ReturnStatus;
  refundAmount: number;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequestItem {
  id: number;
  requestId: number;
  orderItemId: number;
  quantity: number;
}

export interface ReturnRequestImage {
  id: number;
  requestId: number;
  mediaId: number;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
}

export interface StockReceipt {
  id: number;
  code: string;
  type: StockReceiptType;
  supplierId: number | null;
  orderCode: string | null;
  status: StockReceiptStatus;
  createdBy: number | null;
  createdAt: string;
}

export interface StockReceiptItem {
  id: number;
  receiptId: number;
  variantId: number;
  quantity: number;
  costPrice: number;
}

export interface Expense {
  id: number;
  code: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  date: string;
  orderId: number | null;
  receiptId: number | null;
  createdAt: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  imageMediaId: number;
  link: string;
  position: BannerPosition;
  startAt: string;
  endAt: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  category: string;
  coverMediaId: number;
  content: string;
  authorName: string;
  status: ContentStatus;
  views: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface FaqTopic {
  id: number;
  key: string;
  label: string;
  sortOrder: number;
}

export interface FaqItem {
  id: number;
  topicId: number;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface ContactMessage {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  content: string;
  createdAt: string;
}
