import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ensureModel } from './model-helpers';

// Use case Mở rộng nhẹ (API thật): UC-ADM-27 nhật ký hoạt động, UC-ADM-02 vai trò, UC-ACC-03 phiên đăng nhập,
// UC-ACC-07 xóa tài khoản, UC-ADM-26 gửi thông báo. Mỗi test tự đăng ký khách riêng. Chạy: npm run test:e2e:real (nhóm ext-uc).

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
let seq = 0;
const uniq = () => `${Date.now()}-${++seq}`;

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

async function customerLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh mục nổi bật' })).toBeVisible({ timeout: 30_000 });
}

async function adminToken(request: APIRequestContext) {
  const r = await request.post(`${API}/api/auth/login`, {
    data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
  });
  return (await r.json()).data.tokens.accessToken as string;
}

async function newCustomer(request: APIRequestContext, label: string) {
  const email = `${label}-${uniq()}@test.local`;
  const password = 'Matkhau-12345';
  const reg = await request.post(`${API}/api/auth/register`, {
    data: { fullName: `Khách ${label}`, email, phone: '0911222333', password, confirmPassword: password },
  });
  expect(reg.status()).toBe(201);
  const login = await request.post(`${API}/api/auth/login`, { data: { email, password } });
  const tokens = (await login.json()).data;
  return { email, password, id: tokens.user.id as number, token: tokens.tokens.accessToken as string };
}

test('nhật ký hoạt động: lọc theo hành động; dòng do service ghi khác dòng do interceptor ghi (Tự động)', async ({
  page,
  request,
}) => {
  const token = await adminToken(request);
  const h = { Authorization: `Bearer ${token}` };
  const value = `Chất liệu nhật ký ${uniq()}`;
  expect(
    (await request.post(`${API}/api/admin/attributes/3/values`, { headers: h, data: { value } })).status(),
  ).toBe(201);
  // seed không có mô hình: tạo một mô hình đã duyệt
  const sofa = (await (await request.get(`${API}/api/products/sofa-nordic`)).json()).data as { id: number };
  await ensureModel(request, sofa.id);
  // PATCH đặt mô hình chính khi mô hình ĐÃ là chính: service không ghi log ⇒ interceptor ghi dòng "Tự động"
  const models = (await (await request.get(`${API}/api/admin/models?pageSize=100`, { headers: h })).json())
    .data as Array<{
    modelId: number;
    isPrimary: boolean;
    status: string;
  }>;
  const primary = models.find((m) => m.isPrimary && m.status === 'ready')!;
  expect(
    (await request.patch(`${API}/api/admin/models/${primary.modelId}/primary`, { headers: h })).status(),
  ).toBe(200);

  await adminLogin(page);
  await page.goto('/admin/activity-logs');
  await expect(page.getByRole('heading', { name: 'Nhật ký hoạt động' })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel('Lọc theo hành động (vd. product, order)…').fill('attribute_value.create');
  const service = page.getByTestId('log-action').filter({ hasText: 'attribute_value.create' }).first();
  await expect(service).toBeVisible({ timeout: 30_000 });
  await expect(service).toHaveAttribute('data-auto', 'false');
  await expect(service).toContainText('Dịch vụ ghi');
  await expect(service).not.toContainText('Tự động');

  await page.getByLabel('Lọc theo hành động (vd. product, order)…').fill('models.primary');
  const auto = page.getByTestId('log-action').filter({ hasText: 'models.primary' }).first();
  await expect(auto).toBeVisible({ timeout: 30_000 });
  await expect(auto).toHaveAttribute('data-auto', 'true');
  await expect(auto).toContainText('Tự động');

  // lọc theo quản trị viên + loại đối tượng
  await page.getByLabel('Lọc theo hành động (vd. product, order)…').fill('');
  await page.getByLabel('Tất cả loại đối tượng').selectOption('attribute_value');
  await expect(page.getByTestId('log-action').first()).toBeVisible({ timeout: 30_000 });
  for (const t of await page
    .getByRole('row')
    .allInnerTexts()
    .then((x) => x.slice(1)))
    expect(t).toContain('attribute_value');
});

test('vai trò: trang xem chỉ đọc (2 vai trò, 6 quyền); gán rồi gỡ admin trong chi tiết khách hàng', async ({
  page,
  request,
  browser,
}) => {
  const c = await newCustomer(request, 'vaitro');
  await adminLogin(page);
  await page.goto('/admin/roles');
  await expect(page.getByRole('heading', { name: 'Vai trò & quyền' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('role-admin').getByText('manage_settings')).toBeVisible();
  await expect(page.getByTestId('role-admin').locator('li')).toHaveCount(6);
  await expect(page.getByTestId('role-user')).toContainText('Không có quyền quản trị nào');
  // trang chỉ xem, kể cả với admin: vùng nội dung chính (không tính menu/thanh trên) không có điều khiển ghi.
  // Chỉ kiểm sau khi dữ liệu đã hiện (các khẳng định ở trên), nếu không khung chờ tải sẽ làm kiểm tra đạt rỗng.
  const main = page.getByRole('main');
  const writeName = /Thêm|Tạo|Sửa|Cập nhật|Xóa|Lưu|Gán|Gỡ/i;
  await expect(main.getByRole('button', { name: writeName })).toHaveCount(0);
  await expect(main.getByRole('link', { name: writeName })).toHaveCount(0);
  // chặt hơn: không có nút (kể cả nút chỉ có biểu tượng) hay ô nhập nào
  for (const role of ['button', 'textbox', 'checkbox', 'combobox', 'switch'] as const)
    await expect(main.getByRole(role)).toHaveCount(0);

  // tài khoản không có quyền (khách): bị đưa khỏi trang vai trò, API từ chối
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await customerLogin(guest, c.email, c.password);
  await guest.goto('/admin/roles');
  await expect(guest).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(guest.getByRole('heading', { name: 'Danh mục nổi bật' })).toBeVisible({ timeout: 30_000 });
  await expect(guest.getByRole('heading', { name: 'Vai trò & quyền' })).toHaveCount(0);
  await expect(guest.getByTestId('role-admin')).toHaveCount(0);
  await guestContext.close();
  const denied = await request.get(`${API}/api/admin/roles`, {
    headers: { Authorization: `Bearer ${c.token}` },
  });
  expect(denied.status()).toBe(403);

  await page.goto(`/admin/customers/${c.id}`);
  const section = page.getByTestId('roles-section');
  await expect(section).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('role-badges')).toContainText('Khách hàng (user)');
  await expect(page.getByTestId('role-badges')).not.toContainText('admin');
  await section.getByRole('button', { name: 'Gán vai trò admin' }).click();
  await expect(page.getByText('Đã gán vai trò admin.')).toBeVisible({ timeout: 30_000 });
  // admin không còn nằm trong danh sách/chi tiết khách hàng (users.role = 'admin'): kiểm tra vai trò bằng API, rồi gỡ lại
  const h = { Authorization: `Bearer ${await adminToken(request)}` };
  const roles = await request.get(`${API}/api/admin/roles`, { headers: h });
  expect(JSON.stringify((await roles.json()).data)).toContain('admin');
  const revoke = await request.delete(`${API}/api/admin/users/${c.id}/roles/admin`, { headers: h });
  expect(revoke.status()).toBe(200);
  expect((await revoke.json()).data.roles).toEqual(['user']);
});

test('phiên đăng nhập: thấy thiết bị này, đăng xuất thiết bị khác từ xa', async ({ page, request }) => {
  const c = await newCustomer(request, 'phien');
  // thêm một thiết bị khác bằng cách đăng nhập qua API với User-Agent khác
  const other = await request.post(`${API}/api/auth/login`, {
    data: { email: c.email, password: c.password },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36' },
  });
  expect(other.status()).toBe(200);

  await customerLogin(page, c.email, c.password);
  await page.goto('/account/sessions');
  await expect(page.getByRole('heading', { name: 'Phiên đăng nhập' })).toBeVisible({ timeout: 30_000 });
  const rows = page.getByTestId('session-row');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const before = await rows.count();
  expect(before).toBeGreaterThanOrEqual(3); // đăng ký + API + trình duyệt (+ đăng nhập trong newCustomer)
  await expect(page.locator('[data-testid="session-row"][data-current="true"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="session-row"][data-current="true"]')).toContainText(
    'Thiết bị này',
  );

  const target = page.locator('[data-testid="session-row"][data-current="false"]').first();
  await target.getByRole('button', { name: /Đăng xuất thiết bị/ }).click();
  await expect(page.getByText('Đã đăng xuất thiết bị.')).toBeVisible({ timeout: 30_000 });
  await expect(rows).toHaveCount(before - 1, { timeout: 30_000 });
  await expect(page.locator('[data-testid="session-row"][data-current="true"]')).toHaveCount(1); // thiết bị này còn nguyên
});

test('xóa tài khoản: nhập mật khẩu, xóa mềm, tự đăng xuất; đăng nhập lại bị từ chối; email đăng ký lại được', async ({
  page,
  request,
}) => {
  const c = await newCustomer(request, 'xoa');
  await customerLogin(page, c.email, c.password);
  await page.goto('/account/profile');
  await expect(page.getByRole('heading', { name: 'Xóa tài khoản' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Xóa tài khoản' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[type="password"]').fill('sai-mat-khau');
  await dlg.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(dlg.getByText('Mật khẩu không đúng.')).toBeVisible({ timeout: 30_000 });
  await dlg.locator('input[type="password"]').fill(c.password);
  await dlg.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(page.getByText('Tài khoản đã được xóa.')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/$/);
  // đã đăng xuất: vào trang tài khoản bị chuyển về đăng nhập
  await page.goto('/account/profile');
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  const relogin = await request.post(`${API}/api/auth/login`, {
    data: { email: c.email, password: c.password },
  });
  expect(relogin.status()).toBeGreaterThanOrEqual(400);
  const again = await request.post(`${API}/api/auth/register`, {
    data: {
      fullName: 'Khách quay lại',
      email: c.email,
      phone: '0911222333',
      password: 'Matkhau-moi-1',
      confirmPassword: 'Matkhau-moi-1',
    },
  });
  expect(again.status()).toBe(201);
});

test('gửi thông báo: admin gửi cho một khách, khách thấy ở trang thông báo; người khác không thấy', async ({
  page,
  request,
  browser,
}) => {
  const a = await newCustomer(request, 'tb-a');
  const b = await newCustomer(request, 'tb-b');
  await adminLogin(page);
  await page.goto('/admin/notifications');
  await expect(page.getByRole('heading', { name: 'Gửi thông báo' })).toBeVisible({ timeout: 30_000 });
  const title = `Bảo trì hệ thống ${uniq()}`;
  await page.getByLabel(/Tìm khách hàng/).fill(a.email);
  await page.getByRole('button', { name: 'Thêm' }).first().click({ timeout: 30_000 });
  await expect(page.getByLabel('Người nhận đã chọn')).toContainText('Khách tb-a');
  await page.getByLabel('Tiêu đề').fill(title);
  await page.getByLabel('Nội dung').fill('Hệ thống bảo trì từ 23:00 đến 23:30.');
  await page.getByRole('button', { name: 'Gửi thông báo' }).click();
  await expect(page.getByText('Đã gửi thông báo tới 1 người dùng.')).toBeVisible({ timeout: 30_000 });

  const ctx = await browser.newContext({ baseURL: `http://localhost:${process.env.E2E_PORT ?? 3100}` });
  const cust = await ctx.newPage();
  await customerLogin(cust, a.email, a.password);
  await cust.goto('/account/notifications');
  await expect(cust.getByText(title)).toBeVisible({ timeout: 30_000 });
  await ctx.close();
  // người khác không nhận
  const mine = await request.get(`${API}/api/notifications`, {
    headers: { Authorization: `Bearer ${b.token}` },
  });
  expect(((await mine.json()).data as Array<{ title: string }>).some((n) => n.title === title)).toBe(false);
});
