// Chuẩn bị mã giảm giá cho e2e chạy với API thật: spec không dựa vào hạn ghi trong dữ liệu mẫu, mà tự bật và gia hạn
// những mã nó cần (qua API quản trị) nếu mã đang tắt hoặc sắp hết hạn. Chế độ API giả không có gì để chuẩn bị.
import { expect, type APIRequestContext } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const DAY = 86_400_000;

export async function ensureCouponsUsable(request: APIRequestContext, codes: string[]) {
  if (process.env.E2E_USE_MOCK !== 'false') return;
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
  });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await login.json()).data.tokens.accessToken}` };
  // chỉ gửi ngày: API hiểu là hết ngày đó theo giờ Việt Nam
  const endsAt = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10);

  for (const code of codes) {
    const found = await request.get(`${API}/api/admin/coupons?q=${code}`, { headers });
    expect(found.ok()).toBe(true);
    const coupon = (
      (await found.json()).data as Array<{
        id: number;
        code: string;
        endsAt: string | null;
        isActive: boolean;
      }>
    ).find((c) => c.code === code);
    if (!coupon) throw new Error(`dữ liệu mẫu không có mã ${code}`);
    const lastsLongEnough = !coupon.endsAt || new Date(coupon.endsAt).getTime() > Date.now() + 7 * DAY;
    if (coupon.isActive && lastsLongEnough) continue;
    const updated = await request.patch(`${API}/api/admin/coupons/${coupon.id}`, {
      headers,
      data: { isActive: true, endsAt },
    });
    expect(updated.ok()).toBe(true);
  }
}
