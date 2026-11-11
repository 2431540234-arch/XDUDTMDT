// Bảng `coupons` (14 mã: giảm %, giảm tiền, freeship; đang diễn ra / sắp diễn ra / đã kết thúc)
import type { Coupon } from '@aurelia-living/shared-types';
import { categories } from './categories';

export interface CouponExtra {
  // cột mở rộng (đã có trong DB): name, mô tả, phạm vi, loại freeship
  couponId: number;
  name: string;
  description: string;
  kind: 'percent' | 'fixed' | 'freeship';
  appliesTo: 'all' | 'category' | 'product' | 'space';
  appliesToLabel: string;
  categoryIds: number[];
}

const catId = (slug: string) => categories.find((c) => c.slug === slug)!.id;
const sofaId = catId('sofa');
const phongNguId = catId('phong-ngu');
const guongId = catId('giuong');
const tuId = catId('tu-quan-ao');
const nightId = catId('tu-dau-giuong');

interface Def {
  code: string;
  name: string;
  description: string;
  kind: CouponExtra['kind'];
  value: number;
  maxDiscount?: number;
  min: number;
  limit: number | null;
  perUser: number | null;
  used: number;
  start: string;
  end: string | null;
  active?: boolean;
  scope?: { label: string; categoryIds: number[] };
}

const defs: Def[] = [
  {
    code: 'WELCOME10',
    name: 'Chào bạn mới – giảm 10%',
    description: 'Dành cho đơn hàng đầu tiên của khách hàng mới.',
    kind: 'percent',
    value: 10,
    maxDiscount: 200_000,
    min: 500_000,
    limit: 500,
    perUser: 1,
    used: 124,
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-12-31T16:59:00.000Z',
  },
  {
    code: 'FREESHIP',
    name: 'Miễn phí vận chuyển',
    description: 'Miễn phí giao hàng toàn quốc cho đơn từ 1 triệu.',
    kind: 'freeship',
    value: 0,
    min: 1_000_000,
    limit: 1000,
    perUser: 5,
    used: 312,
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-12-31T16:59:00.000Z',
  },
  {
    code: 'NOITHAT20',
    name: 'Nội thất giảm 20%',
    description: 'Giảm 20% tối đa 2 triệu cho đơn từ 5 triệu.',
    kind: 'percent',
    value: 20,
    maxDiscount: 2_000_000,
    min: 5_000_000,
    limit: 300,
    perUser: 2,
    used: 87,
    start: '2026-09-15T00:00:00.000Z',
    end: '2026-12-15T16:59:00.000Z',
  },
  {
    code: 'BLACKFRIDAY',
    name: 'Black Friday – giảm 25%',
    description: 'Siêu ưu đãi cuối năm, giảm 25% tối đa 3 triệu.',
    kind: 'percent',
    value: 25,
    maxDiscount: 3_000_000,
    min: 8_000_000,
    limit: 200,
    perUser: 1,
    used: 0,
    start: '2026-11-24T00:00:00.000Z',
    end: '2026-11-30T16:59:00.000Z',
  },
  {
    code: 'SUMMER2026',
    name: 'Hè rực rỡ 2026',
    description: 'Giảm 15% cho mọi đơn hàng trong mùa hè.',
    kind: 'percent',
    value: 15,
    maxDiscount: 1_500_000,
    min: 3_000_000,
    limit: 400,
    perUser: 2,
    used: 366,
    start: '2026-06-01T00:00:00.000Z',
    end: '2026-08-31T16:59:00.000Z',
  },
  {
    code: 'GIAM200K',
    name: 'Giảm 200.000đ',
    description: 'Giảm trực tiếp 200.000đ cho đơn từ 2 triệu.',
    kind: 'fixed',
    value: 200_000,
    min: 2_000_000,
    limit: 600,
    perUser: 3,
    used: 211,
    start: '2026-03-01T00:00:00.000Z',
    end: '2026-12-31T16:59:00.000Z',
  },
  {
    code: 'GIAM500K',
    name: 'Giảm 500.000đ',
    description: 'Giảm 500.000đ cho đơn từ 6 triệu.',
    kind: 'fixed',
    value: 500_000,
    min: 6_000_000,
    limit: 250,
    perUser: 2,
    used: 96,
    start: '2026-04-01T00:00:00.000Z',
    end: '2026-12-31T16:59:00.000Z',
  },
  {
    code: 'SOFA12',
    name: 'Sofa giảm 12%',
    description: 'Giảm 12% cho danh mục Sofa.',
    kind: 'percent',
    value: 12,
    maxDiscount: 1_800_000,
    min: 4_000_000,
    limit: 150,
    perUser: 1,
    used: 41,
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-11-30T16:59:00.000Z',
    scope: { label: 'Danh mục Sofa', categoryIds: [sofaId] },
  },
  {
    code: 'TET2027',
    name: 'Tết 2027 – giảm 18%',
    description: 'Đón Tết rộn ràng, giảm 18% mọi sản phẩm.',
    kind: 'percent',
    value: 18,
    maxDiscount: 2_500_000,
    min: 5_000_000,
    limit: 300,
    perUser: 1,
    used: 0,
    start: '2027-01-10T00:00:00.000Z',
    end: '2027-02-15T16:59:00.000Z',
  },
  {
    code: 'NEWYEAR2026',
    name: 'Chào năm mới 2026',
    description: 'Giảm 300.000đ đơn từ 3 triệu dịp đầu năm.',
    kind: 'fixed',
    value: 300_000,
    min: 3_000_000,
    limit: 200,
    perUser: 1,
    used: 200,
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-01-31T16:59:00.000Z',
  },
  {
    code: 'PHONGNGU150',
    name: 'Phòng ngủ giảm 150.000đ',
    description: 'Giảm 150.000đ cho nhóm sản phẩm phòng ngủ.',
    kind: 'fixed',
    value: 150_000,
    min: 1_500_000,
    limit: 400,
    perUser: 2,
    used: 58,
    start: '2026-08-01T00:00:00.000Z',
    end: '2026-12-31T16:59:00.000Z',
    scope: { label: 'Phòng ngủ (giường, tủ)', categoryIds: [phongNguId, guongId, tuId, nightId] },
  },
  {
    code: 'VIP20',
    name: 'Ưu đãi khách thân thiết',
    description: 'Giảm 20% tối đa 1,5 triệu cho khách hàng thân thiết.',
    kind: 'percent',
    value: 20,
    maxDiscount: 1_500_000,
    min: 3_000_000,
    limit: 100,
    perUser: 3,
    used: 34,
    start: '2026-05-01T00:00:00.000Z',
    end: '2026-12-31T16:59:00.000Z',
  },
  {
    code: 'FLASH11',
    name: 'Flash Sale 11.11',
    description: 'Giảm 11% tối đa 1,1 triệu trong tuần lễ 11.11.',
    kind: 'percent',
    value: 11,
    maxDiscount: 1_100_000,
    min: 2_000_000,
    limit: 500,
    perUser: 1,
    used: 73,
    start: '2026-11-01T00:00:00.000Z',
    end: '2026-11-15T16:59:00.000Z',
  },
  {
    code: 'GIAM1TR',
    name: 'Giảm 1 triệu',
    description: 'Giảm 1.000.000đ cho đơn từ 15 triệu (đã tạm dừng).',
    kind: 'fixed',
    value: 1_000_000,
    min: 15_000_000,
    limit: 50,
    perUser: 1,
    used: 12,
    start: '2026-02-01T00:00:00.000Z',
    end: '2026-12-31T16:59:00.000Z',
    active: false,
  },
];

export const coupons: Coupon[] = defs.map((d, i) => ({
  id: i + 1,
  code: d.code,
  type: d.kind === 'percent' ? 'percent' : 'fixed',
  value: d.value,
  maxDiscount: d.maxDiscount ?? null,
  minOrderValue: d.min,
  usageLimit: d.limit,
  perUserLimit: d.perUser,
  usedCount: d.used,
  startsAt: d.start,
  endsAt: d.end,
  isActive: d.active ?? true,
  createdAt: '2026-01-02T08:00:00.000Z',
  updatedAt: '2026-01-02T08:00:00.000Z',
}));

export const couponExtras: CouponExtra[] = defs.map((d, i) => ({
  couponId: i + 1,
  name: d.name,
  description: d.description,
  kind: d.kind,
  appliesTo: d.scope ? 'category' : 'all',
  appliesToLabel: d.scope?.label ?? 'Tất cả sản phẩm',
  categoryIds: d.scope?.categoryIds ?? [],
}));
