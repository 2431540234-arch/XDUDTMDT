// Ánh xạ trạng thái (enum DB) → nhãn tiếng Việt + màu badge theo WIREFRAME.md mục 0.2
import type {
  ContentStatus,
  ModelStatus,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  ReviewStatus,
  RoomType,
  ShipmentStatus,
  UserStatus,
} from '@aurelia-living/shared-types';

export type BadgeTone = 'orange' | 'blue' | 'purple' | 'green' | 'red' | 'yellow' | 'gray';

export const toneClass: Record<BadgeTone, string> = {
  orange: 'bg-orange-100 text-orange-700',
  blue: 'bg-sky-100 text-sky-700',
  purple: 'bg-violet-100 text-violet-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-rose-100 text-rose-700',
  yellow: 'bg-amber-100 text-amber-700',
  gray: 'bg-stone-200 text-stone-600',
};

export interface StatusInfo {
  label: string;
  tone: BadgeTone;
}

export const orderStatusInfo: Record<OrderStatus, StatusInfo> = {
  pending: { label: 'Chờ xác nhận', tone: 'orange' },
  confirmed: { label: 'Đã xác nhận', tone: 'blue' },
  processing: { label: 'Đang xử lý', tone: 'blue' },
  shipping: { label: 'Đang giao', tone: 'purple' },
  completed: { label: 'Đã giao', tone: 'green' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
  refunded: { label: 'Hoàn tiền', tone: 'red' },
};

export const paymentStatusInfo: Record<OrderPaymentStatus, StatusInfo> = {
  unpaid: { label: 'Chưa thanh toán', tone: 'yellow' },
  paid: { label: 'Đã thanh toán', tone: 'green' },
  refunded: { label: 'Hoàn tiền', tone: 'red' },
  failed: { label: 'Thanh toán lỗi', tone: 'red' },
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
  vnpay: 'VNPAY',
  zalopay: 'ZaloPay',
  card: 'Thẻ ngân hàng / Thẻ tín dụng',
};

export const paymentMethodShort: Record<PaymentMethod, string> = {
  cod: 'COD',
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPAY',
  zalopay: 'ZaloPay',
  card: 'Thẻ',
};

export const productStatusInfo = (stock: number, status: ContentStatus): StatusInfo =>
  status !== 'published'
    ? { label: status === 'draft' ? 'Bản nháp' : 'Ẩn', tone: 'red' }
    : stock <= 0
      ? { label: 'Tạm hết hàng', tone: 'yellow' }
      : { label: 'Đang bán', tone: 'green' };

export const contentStatusInfo: Record<ContentStatus, StatusInfo> = {
  published: { label: 'Đang hiển thị', tone: 'green' },
  draft: { label: 'Bản nháp', tone: 'yellow' },
  archived: { label: 'Ẩn hiển thị', tone: 'red' },
};

export const reviewStatusInfo: Record<ReviewStatus, StatusInfo> = {
  approved: { label: 'Hiển thị', tone: 'green' },
  pending: { label: 'Chờ duyệt', tone: 'yellow' },
  rejected: { label: 'Ẩn', tone: 'red' },
};

export const userStatusInfo: Record<UserStatus, StatusInfo> = {
  active: { label: 'Hoạt động', tone: 'green' },
  suspended: { label: 'Không hoạt động', tone: 'red' },
  banned: { label: 'Bị cấm', tone: 'red' },
};

export const shipmentStatusInfo: Record<ShipmentStatus, StatusInfo> = {
  pending: { label: 'Chờ lấy hàng', tone: 'orange' },
  picked_up: { label: 'Đã lấy hàng', tone: 'blue' },
  in_transit: { label: 'Đang vận chuyển', tone: 'purple' },
  delivered: { label: 'Đã giao', tone: 'green' },
  failed: { label: 'Giao thất bại', tone: 'red' },
  returned: { label: 'Hoàn hàng', tone: 'red' },
};

export const modelStatusInfo: Record<ModelStatus, StatusInfo> = {
  uploading: { label: 'Đang tải lên', tone: 'blue' },
  processing: { label: 'Đang xử lý', tone: 'yellow' },
  ready: { label: 'Sẵn sàng', tone: 'green' },
  failed: { label: 'Lỗi', tone: 'red' },
};

/** Trạng thái khuyến mãi suy từ isActive + thời gian */
export function couponStatus(
  c: { isActive: boolean; startsAt: string; endsAt: string | null },
  now: Date = new Date(),
): StatusInfo {
  if (!c.isActive) return { label: 'Đã kết thúc', tone: 'red' };
  if (new Date(c.startsAt) > now) return { label: 'Sắp diễn ra', tone: 'yellow' };
  if (c.endsAt && new Date(c.endsAt) < now) return { label: 'Đã kết thúc', tone: 'red' };
  return { label: 'Đang diễn ra', tone: 'green' };
}

export const userCouponStatusInfo: Record<'unused' | 'used' | 'expired', StatusInfo> = {
  unused: { label: 'Chưa sử dụng', tone: 'green' },
  used: { label: 'Đã sử dụng', tone: 'gray' },
  expired: { label: 'Hết hạn', tone: 'red' },
};

export const returnStatusInfo: Record<
  'pending' | 'picking' | 'inspecting' | 'refunded' | 'exchanged' | 'rejected',
  StatusInfo
> = {
  pending: { label: 'Chờ duyệt', tone: 'orange' },
  picking: { label: 'Đang lấy hàng', tone: 'blue' },
  inspecting: { label: 'Đang kiểm tra', tone: 'purple' },
  refunded: { label: 'Đã hoàn tiền', tone: 'green' },
  exchanged: { label: 'Đã đổi', tone: 'green' },
  rejected: { label: 'Từ chối', tone: 'red' },
};

export const roomTypeLabel: Record<RoomType, string> = {
  living_room: 'Phòng khách',
  bedroom: 'Phòng ngủ',
  kitchen: 'Nhà bếp',
  dining_room: 'Phòng ăn',
  bathroom: 'Phòng tắm',
  office: 'Phòng làm việc',
  other: 'Khác',
};

/** Luồng 5 bước hiển thị ở stepper đơn hàng */
export const ORDER_FLOW: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipping', 'completed'];
export const orderStepLabels = ['Đặt hàng', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Đã giao'];

export const returnReasonLabel: Record<
  'defect' | 'wrong_item' | 'not_as_described' | 'missing_accessory' | 'change_mind',
  string
> = {
  defect: 'Sản phẩm bị lỗi/hư hỏng',
  wrong_item: 'Giao sai mẫu/màu',
  not_as_described: 'Không đúng mô tả',
  missing_accessory: 'Thiếu phụ kiện',
  change_mind: 'Đổi ý, không muốn mua nữa',
};
