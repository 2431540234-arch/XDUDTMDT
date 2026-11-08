// Dữ liệu demo cho phễu không gian mẫu (UC-ADM-29): lượt xem 30 ngày gần nhất (tính từ lúc chạy seed) để biểu đồ "Hiệu quả không
// gian mẫu" có số ngay với khoảng thời gian mặc định. Xác định (cùng đầu vào ⇒ cùng kết quả, trừ mốc thời gian), có người xem quay
// lại và khách vãng lai/đã đăng nhập dùng chung visitorId để thấy việc gộp theo visitorId.
import { createHash } from 'node:crypto';

export interface RecentView {
  spaceId: number;
  userId: number | null;
  visitorId: string;
  sourceProductId: number | null;
  hotspotClickCount: number;
  addedToCart: boolean;
  createdAt: Date;
}

const uuidOf = (s: string) => {
  const h = createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

export function recentSpaceViews(
  spaceIds: number[],
  productIds: number[],
  userIds: number[],
  now = new Date(),
): RecentView[] {
  let seed = 20261109;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const out: RecentView[] = [];
  for (const spaceId of spaceIds) {
    const n = 16 + Math.floor(rnd() * 20); // 16–35 lượt xem mỗi không gian
    for (let k = 0; k < n; k++) {
      const clicks = rnd() < 0.7 ? 1 + Math.floor(rnd() * 5) : 0;
      out.push({
        spaceId,
        // ~12 người xem khác nhau mỗi không gian ⇒ có người xem nhiều lần
        visitorId: uuidOf(`${spaceId}-visitor-${Math.floor(rnd() * 12)}`),
        userId: userIds.length && rnd() < 0.3 ? pick(userIds) : null,
        sourceProductId: productIds.length && rnd() < 0.4 ? pick(productIds) : null,
        hotspotClickCount: clicks,
        addedToCart: clicks > 0 ? rnd() < 0.3 : rnd() < 0.04,
        createdAt: new Date(now.getTime() - Math.floor(rnd() * 29 * 86_400_000) - 3_600_000),
      });
    }
  }
  return out;
}
