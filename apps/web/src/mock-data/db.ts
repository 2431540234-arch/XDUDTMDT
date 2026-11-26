// "Cơ sở dữ liệu" giả: nạp từ các file bảng trong ./tables, lưu thay đổi vào localStorage.
// getDb() trả về đối tượng dùng chung; saveDb() ghi lại; resetDb() khôi phục dữ liệu mẫu.
import {
  activityLogs,
  carts,
  cartItems,
  notifications,
  reviewExtras,
  reviews,
  wishlists,
} from './tables/_social_gen';
import { faqTopics, settings } from './tables/_content_gen';
import {
  couponUsages,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  shipments,
} from './tables/_orders_gen';
import {
  product3dModels,
  modelFiles,
  productExtras,
  productImages,
  productVariants,
  products,
  variantAttributeValues,
} from './tables/_products_gen';
import { spaceHotspots, spacePanoramas, spaceProductPlacements, spaces } from './tables/_spaces_gen';
import { attributeValues, colorHexByValueId } from './tables/attributes';
import { addressLabels, addresses } from './tables/addresses';
import { categories, categoryExtras } from './tables/categories';
import { couponExtras, coupons } from './tables/coupons';
import { photoSignature } from './utils/photos';
import { media } from './tables/media';
import { credentials, userProfiles, users } from './tables/users';

// Đổi số phiên bản khi cấu trúc dữ liệu mock thay đổi (dữ liệu cũ trong localStorage sẽ tự bị bỏ, nạp lại dữ liệu mẫu)
// Hậu tố theo bảng ghép và ảnh thật đang có: đổi một trong hai thì dữ liệu đã lưu cũng được nạp lại
export const DB_STORAGE_KEY = `aurelia-mock-db-v8-${photoSignature()}`;
export const CONFIG_STORAGE_KEY = 'aurelia-mock-config';

export interface MockConfig {
  /** Giả lập độ trễ 200–500ms */
  latency: boolean;
  /** Tỉ lệ request ngẫu nhiên trả lỗi 500 (0–1) để thử trạng thái lỗi */
  errorRate: number;
  /** Ép mọi request GET trả lỗi (nút "thử lại") */
  forceError: boolean;
}

export const defaultConfig: MockConfig = { latency: true, errorRate: 0, forceError: false };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function seed() {
  const db = {
    users: clone(users),
    userProfiles: clone(userProfiles),
    credentials: clone(credentials),
    addresses: clone(addresses),
    addressLabels: clone(addressLabels),
    categories: clone(categories),
    categoryExtras: clone(categoryExtras),
    attributeValues: clone(attributeValues),
    colorHexByValueId: clone(colorHexByValueId),
    products: clone(products),
    productVariants: clone(productVariants),
    variantAttributeValues: clone(variantAttributeValues),
    productImages: clone(productImages),
    productExtras: clone(productExtras),
    product3dModels: clone(product3dModels),
    modelFiles: clone(modelFiles),
    media: clone(media),
    spaces: clone(spaces),
    spacePanoramas: clone(spacePanoramas),
    spaceHotspots: clone(spaceHotspots),
    spaceProductPlacements: clone(spaceProductPlacements),
    carts: clone(carts),
    cartItems: clone(cartItems),
    /** Mã giảm giá đang áp trong giỏ: userId → code */
    cartCoupons: {} as Record<number, string>,
    wishlists: clone(wishlists),
    coupons: clone(coupons),
    couponExtras: clone(couponExtras),
    couponUsages: clone(couponUsages),
    orders: clone(orders),
    orderItems: clone(orderItems),
    orderStatusHistory: clone(orderStatusHistory),
    payments: clone(payments),
    shipments: clone(shipments),
    /** Ghi chú nội bộ của admin theo đơn (chưa có trong DB) */
    orderNotes: {} as Record<number, string>,
    reviews: clone(reviews),
    reviewExtras: clone(reviewExtras),
    notifications: clone(notifications),
    activityLogs: clone(activityLogs),
    faqTopics: clone(faqTopics),
    settings: clone(settings),
    /** Mã OTP đặt lại mật khẩu theo email (mock: luôn 123456) */
    // token đặt lại mật khẩu (mock thay cho email): token -> email + hạn
    resetTokens: {} as Record<string, { email: string; expiresAt: string }>,
  };
  recomputeAggregates(db);
  return db;
}

export type Db = ReturnType<typeof seed>;

/** Các số tổng hợp luôn tính từ dữ liệu gốc (không gõ cứng) */
export function recomputeAggregates(db: Db) {
  for (const p of db.products) {
    const approved = db.reviews.filter((r) => r.productId === p.id && r.status === 'approved');
    p.ratingCount = approved.length;
    p.ratingAvg = approved.length
      ? Math.round((approved.reduce((s, r) => s + r.rating, 0) / approved.length) * 10) / 10
      : 0;
    const vids = new Set(db.productVariants.filter((v) => v.productId === p.id).map((v) => v.id));
    p.soldCount = db.orderItems
      .filter(
        (it) =>
          it.variantId &&
          vids.has(it.variantId) &&
          ['completed', 'shipping', 'processing', 'confirmed', 'pending'].includes(
            db.orders.find((o) => o.id === it.orderId)?.status ?? '',
          ),
      )
      .reduce((s, it) => s + it.quantity, 0);
    const model = db.product3dModels.find((m) => m.productId === p.id && m.isPrimary && m.status === 'ready');
    p.has3dModel = Boolean(model);
  }
  for (const c of db.coupons) c.usedCount = db.couponUsages.filter((u) => u.couponId === c.id).length;
}

let cache: Db | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadFromStorage(): Db | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Db) : null;
  } catch {
    return null;
  }
}

export function getDb(): Db {
  if (!cache) cache = loadFromStorage() ?? seed();
  return cache;
}

export function saveDb() {
  if (typeof window === 'undefined' || !cache) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(cache));
    } catch {
      /* hết dung lượng localStorage: bỏ qua, dữ liệu vẫn còn trong bộ nhớ */
    }
  }, 150);
}

/** Khôi phục dữ liệu mẫu (xóa localStorage, nạp lại từ file bảng) */
export function resetDb() {
  cache = seed();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DB_STORAGE_KEY);
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(cache));
  }
  return cache;
}

export function getConfig(): MockConfig {
  if (typeof window === 'undefined') return defaultConfig;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? { ...defaultConfig, ...(JSON.parse(raw) as Partial<MockConfig>) } : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

export function setConfig(patch: Partial<MockConfig>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ ...getConfig(), ...patch }));
}

export const nextId = (rows: Array<{ id: number }>) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

/** Dữ liệu seed thô (dùng cho test và README) */
export function buildSeed(): Db {
  return seed();
}
