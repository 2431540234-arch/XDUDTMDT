import { expect, test, type Page, type Route } from '@playwright/test';

// "Tìm kiếm rồi lưu ngay" (API thật): danh sách tìm kiếm (lần tải ĐẦU của khóa mới) đang bay lúc thao tác ghi hoàn tất.
// Test chủ động dựng đúng thứ tự gây lỗi, không dựa vào may rủi về thời gian:
//   1) request tìm kiếm được máy chủ trả lời (ảnh chụp dữ liệu TRƯỚC khi ghi) nhưng bị giữ lại ở trình duyệt;
//   2) thao tác ghi (PATCH/DELETE) chỉ được gửi đi sau khi có ảnh chụp đó và hoàn tất;
//   3) sau khi ghi xong mới thả kết quả tìm kiếm cũ ra.
// Nếu trang chỉ gọi invalidateQueries trơn thì dữ liệu cũ ở lại; với QueryClient write-safe (lib/query-refresh.ts) thì
// lần tải cũ bị hủy và danh sách được tải lại SAU khi ghi. Chạy: npm run test:e2e:real (nhóm admin-race).

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

/** Giữ lần tải tìm kiếm đầu tiên (đã đọc dữ liệu trước khi ghi) cho tới khi thả; chặn request ghi cho tới khi đã có ảnh chụp */
async function arrangeRace(page: Page, searchUrl: RegExp, writeUrl: RegExp, writeMethod: string) {
  let snapshotTaken!: () => void;
  const snapshot = new Promise<void>((r) => (snapshotTaken = r));
  let releaseSearch!: () => void;
  const gate = new Promise<void>((r) => (releaseSearch = r));
  let held = false;
  await page.route(searchUrl, async (route: Route) => {
    if (held) return route.continue();
    held = true;
    const stale = await route.fetch(); // máy chủ trả dữ liệu TRƯỚC khi thao tác ghi được gửi đi
    snapshotTaken();
    await gate;
    await route.fulfill({ response: stale });
  });
  await page.route(writeUrl, async (route: Route) => {
    if (route.request().method() !== writeMethod) return route.continue();
    await snapshot; // chỉ ghi sau khi lần tải tìm kiếm đã đọc xong dữ liệu cũ
    await route.continue();
  });
  return { releaseSearch: () => releaseSearch() };
}

test('khách hàng: tìm kiếm rồi khóa tài khoản ngay ⇒ danh sách hiện đúng trạng thái mới (không giữ dữ liệu cũ)', async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto('/admin/customers');
  await expect(page.getByRole('heading', { name: 'Khách hàng' }).first()).toBeVisible({ timeout: 30_000 });
  const row = page.getByRole('row').filter({ hasText: 'Hoạt động' }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const email = (await row.locator('td').nth(1).innerText()).trim();
  expect(email).toContain('@');

  const race = await arrangeRace(
    page,
    /\/api\/admin\/users\?.*q=/,
    /\/api\/admin\/users\/\d+\/status/,
    'PATCH',
  );

  await row.getByRole('button', { name: 'Thao tác' }).click(); // mở menu thao tác (dữ liệu cũ vẫn hiển thị)
  await page.getByPlaceholder(/Tìm theo tên, email/).fill(email); // gõ tìm kiếm: khóa truy vấn mới sau 300 ms
  const wrote = page.waitForResponse(
    (r) => /\/api\/admin\/users\/\d+\/status/.test(r.url()) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Khóa / Mở khóa' }).click(); // lưu ngay, trước khi kết quả tìm kiếm về
  expect((await wrote).status()).toBe(200);
  await expect(page.getByText('Đã khóa tài khoản.')).toBeVisible({ timeout: 30_000 });

  race.releaseSearch(); // kết quả tìm kiếm cũ (còn "Hoạt động") về sau khi đã ghi
  const result = page.getByRole('row').filter({ hasText: email });
  await expect(result).toHaveCount(1, { timeout: 30_000 });
  await expect(result).toContainText('Không hoạt động'); // dữ liệu mới, không phải ảnh chụp cũ
  await expect(result).not.toContainText(/Hoạt động\s*$/);
});

test('sản phẩm: tìm kiếm rồi xóa ngay ⇒ sản phẩm biến mất khỏi danh sách (không giữ dòng cũ)', async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: /Sản phẩm/ }).first()).toBeVisible({ timeout: 30_000 });
  const row = page.getByRole('row').nth(1);
  await expect(row).toBeVisible({ timeout: 30_000 });
  const name = (await row.locator('td').nth(2).innerText()).split('\n')[0].trim();
  expect(name.length).toBeGreaterThan(2);

  const race = await arrangeRace(
    page,
    /\/api\/admin\/products\?.*q=/,
    /\/api\/admin\/products\/\d+$/,
    'DELETE',
  );

  await row.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click(); // mở hộp thoại xác nhận
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  await page.getByPlaceholder(/Tìm theo tên hoặc SKU/).fill(name); // gõ tìm kiếm trong lúc hộp thoại đang mở
  const wrote = page.waitForResponse(
    (r) => /\/api\/admin\/products\/\d+$/.test(r.url()) && r.request().method() === 'DELETE',
  );
  await dlg.getByRole('button', { name: 'Xóa', exact: true }).click();
  expect((await wrote).status()).toBe(200);
  await expect(page.getByText('Đã xóa sản phẩm.')).toBeVisible({ timeout: 30_000 });

  race.releaseSearch(); // kết quả tìm kiếm cũ (còn sản phẩm) về sau khi đã xóa
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0, { timeout: 30_000 });
});
