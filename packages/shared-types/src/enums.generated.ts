// FILE SINH TỰ ĐỘNG từ apps/api/prisma/schema.prisma bằng scripts/generate-shared-types.mjs
// KHÔNG SỬA TAY. Sửa schema.prisma rồi chạy: npm run types:generate

export const ContentStatus = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
} as const;
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];

export const CouponType = {
  percent: 'percent',
  fixed: 'fixed',
  freeship: 'freeship',
} as const;
export type CouponType = (typeof CouponType)[keyof typeof CouponType];

export const HotspotType = {
  product: 'product',
  navigation: 'navigation',
  info: 'info',
} as const;
export type HotspotType = (typeof HotspotType)[keyof typeof HotspotType];

export const InventoryMovementType = {
  import: 'import',
  sale: 'sale',
  return: 'return',
  adjustment: 'adjustment',
} as const;
export type InventoryMovementType = (typeof InventoryMovementType)[keyof typeof InventoryMovementType];

export const ModelFileFormat = {
  glb: 'glb',
  usdz: 'usdz',
} as const;
export type ModelFileFormat = (typeof ModelFileFormat)[keyof typeof ModelFileFormat];

export const ModelLod = {
  high: 'high',
  medium: 'medium',
  low: 'low',
} as const;
export type ModelLod = (typeof ModelLod)[keyof typeof ModelLod];

export const ModelPlacement = {
  floor: 'floor',
  wall: 'wall',
  table: 'table',
} as const;
export type ModelPlacement = (typeof ModelPlacement)[keyof typeof ModelPlacement];

export const ModelStatus = {
  uploading: 'uploading',
  processing: 'processing',
  ready: 'ready',
  failed: 'failed',
} as const;
export type ModelStatus = (typeof ModelStatus)[keyof typeof ModelStatus];

export const OrderPaymentStatus = {
  unpaid: 'unpaid',
  paid: 'paid',
  refunded: 'refunded',
  failed: 'failed',
} as const;
export type OrderPaymentStatus = (typeof OrderPaymentStatus)[keyof typeof OrderPaymentStatus];

export const OrderStatus = {
  pending: 'pending',
  confirmed: 'confirmed',
  processing: 'processing',
  shipping: 'shipping',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'refunded',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  cod: 'cod',
  bank_transfer: 'bank_transfer',
  momo: 'momo',
  vnpay: 'vnpay',
  zalopay: 'zalopay',
  card: 'card',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentTxnStatus = {
  pending: 'pending',
  success: 'success',
  failed: 'failed',
  refunded: 'refunded',
} as const;
export type PaymentTxnStatus = (typeof PaymentTxnStatus)[keyof typeof PaymentTxnStatus];

export const ReviewStatus = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const RoomType = {
  living_room: 'living_room',
  bedroom: 'bedroom',
  kitchen: 'kitchen',
  dining_room: 'dining_room',
  bathroom: 'bathroom',
  office: 'office',
  other: 'other',
} as const;
export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export const ShipmentCarrier = {
  ghn: 'ghn',
  ghtk: 'ghtk',
  viettel_post: 'viettel_post',
  other: 'other',
} as const;
export type ShipmentCarrier = (typeof ShipmentCarrier)[keyof typeof ShipmentCarrier];

export const ShipmentStatus = {
  pending: 'pending',
  picked_up: 'picked_up',
  in_transit: 'in_transit',
  delivered: 'delivered',
  failed: 'failed',
  returned: 'returned',
} as const;
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const UserStatus = {
  active: 'active',
  suspended: 'suspended',
  banned: 'banned',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const QuestionStatus = {
  unanswered: 'unanswered',
  answered: 'answered',
  hidden: 'hidden',
} as const;
export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export const ReturnType = {
  refund: 'refund',
  exchange: 'exchange',
} as const;
export type ReturnType = (typeof ReturnType)[keyof typeof ReturnType];

export const ReturnReason = {
  defect: 'defect',
  wrong_item: 'wrong_item',
  not_as_described: 'not_as_described',
  missing_accessory: 'missing_accessory',
  change_mind: 'change_mind',
} as const;
export type ReturnReason = (typeof ReturnReason)[keyof typeof ReturnReason];

export const ReturnStatus = {
  pending: 'pending',
  picking: 'picking',
  inspecting: 'inspecting',
  refunded: 'refunded',
  exchanged: 'exchanged',
  rejected: 'rejected',
} as const;
export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const StockReceiptType = {
  in: 'in',
  out: 'out',
} as const;
export type StockReceiptType = (typeof StockReceiptType)[keyof typeof StockReceiptType];

export const StockReceiptStatus = {
  draft: 'draft',
  completed: 'completed',
  cancelled: 'cancelled',
} as const;
export type StockReceiptStatus = (typeof StockReceiptStatus)[keyof typeof StockReceiptStatus];

export const ExpenseCategory = {
  cogs: 'cogs',
  shipping: 'shipping',
  marketing: 'marketing',
  payment_fee: 'payment_fee',
  refund: 'refund',
  other: 'other',
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const BannerPosition = {
  hero_1: 'hero-1',
  hero_2: 'hero-2',
  hero_3: 'hero-3',
  home_left: 'home-left',
  home_right: 'home-right',
  home_3d: 'home-3d',
} as const;
export type BannerPosition = (typeof BannerPosition)[keyof typeof BannerPosition];
