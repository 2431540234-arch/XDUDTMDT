import { expect, test } from '@playwright/test';
import { visit } from './helpers/visit';

// Duyệt lần lượt các màn hình: không lỗi console (kể cả hydration), không request lỗi, không ảnh vỡ. Hàm visit ở helpers/visit.ts.

test.describe.configure({ mode: 'serial' });

test('storefront công khai', async ({ page }) => {
  test.setTimeout(300_000);
  await visit(page, '/', 'Danh mục nổi bật');
  await visit(page, '/products', 'sản phẩm');
  await visit(page, '/products?category=sofa', 'Khám phá các mẫu sofa');
  await visit(page, '/products/sofa-nordic', 'Sofa Nordic');
  await visit(page, '/products/sofa-nordic/3d', /Trình xem 3D/);
  await visit(page, '/search?q=sofa', /Kết quả tìm kiếm/);
  await visit(page, '/spaces', 'Không gian mẫu');
  await visit(page, '/cart', /đăng nhập để xem giỏ hàng/);
  await visit(page, '/login', 'ĐĂNG NHẬP');
  await visit(page, '/register', 'ĐĂNG KÝ');
  await visit(page, '/forgot-password', 'QUÊN MẬT KHẨU');
  await visit(page, '/reset-password?token=' + 'a'.repeat(64), 'ĐẶT LẠI MẬT KHẨU');
  await visit(page, '/about', 'Giá trị cốt lõi');
  await visit(page, '/contact', 'Liên hệ với chúng tôi');
  await visit(page, '/faq', 'Câu hỏi thường gặp');
  await visit(page, '/policies/chinh-sach-doi-tra', 'Chính sách đổi trả');
  await visit(page, '/wishlist', /Đăng nhập để xem/);
});

// Luồng thật: cần API thật (E2E_USE_MOCK=false) và Mailpit đang chạy (mặc định http://localhost:8025)
test('quên mật khẩu bằng liên kết: email (Mailpit) → đặt mật khẩu mới → đăng nhập; liên kết chỉ dùng một lần', async ({
  page,
  request,
}) => {
  test.skip(process.env.E2E_USE_MOCK !== 'false', 'chỉ chạy với API thật');
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const mailpit = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
  const email = `reset${Date.now()}@example.com`;
  const reg = await request.post(`${api}/api/auth/register`, {
    data: {
      fullName: 'Khách Đặt Lại',
      email,
      phone: '0912345678',
      password: 'Matkhau-cu-1',
      confirmPassword: 'Matkhau-cu-1',
    },
  });
  expect(reg.status()).toBe(201);

  await page.goto('/forgot-password');
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }).click();
  await expect(page.getByText('vừa được gửi')).toBeVisible({ timeout: 30_000 });

  let token = '';
  await expect
    .poll(
      async () => {
        const found = await request.get(`${mailpit}/api/v1/search`, { params: { query: `to:${email}` } });
        const list = (await found.json()) as { messages?: Array<{ ID: string }> };
        if (!list.messages?.length) return '';
        const msg = await request.get(`${mailpit}/api/v1/message/${list.messages[0].ID}`);
        const text = ((await msg.json()) as { Text?: string }).Text ?? '';
        token = /token=([0-9a-f]{64})/.exec(text)?.[1] ?? '';
        return token;
      },
      { timeout: 30_000 },
    )
    .toMatch(/^[0-9a-f]{64}$/);

  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel(/^Mật khẩu mới/).fill('Matkhau-moi-2');
  await page.getByLabel(/^Xác nhận mật khẩu mới/).fill('Matkhau-moi-2');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

  const okLogin = await request.post(`${api}/api/auth/login`, { data: { email, password: 'Matkhau-moi-2' } });
  expect(okLogin.status()).toBe(200);
  const oldLogin = await request.post(`${api}/api/auth/login`, { data: { email, password: 'Matkhau-cu-1' } });
  expect(oldLogin.status()).toBe(401);

  // dùng lại cùng liên kết ⇒ báo lỗi
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel(/^Mật khẩu mới/).fill('Matkhau-khac-3');
  await page.getByLabel(/^Xác nhận mật khẩu mới/).fill('Matkhau-khac-3');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
  await expect(page.getByText('không đúng hoặc đã hết hạn')).toBeVisible({ timeout: 30_000 });
});

test('xác thực email: đăng ký ⇒ email (Mailpit) ⇒ mở liên kết ⇒ tài khoản được đánh dấu đã xác thực', async ({
  page,
  request,
}) => {
  test.skip(process.env.E2E_USE_MOCK !== 'false', 'chỉ chạy với API thật');
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const mailpit = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
  const email = `verify${Date.now()}@example.com`;
  const reg = await request.post(`${api}/api/auth/register`, {
    data: {
      fullName: 'Khách Xác Thực',
      email,
      phone: '0912345678',
      password: 'Matkhau-12345',
      confirmPassword: 'Matkhau-12345',
    },
  });
  expect(reg.status()).toBe(201);
  const access = (await reg.json()).data.tokens.accessToken as string;
  const me = async () =>
    (
      await (
        await request.get(`${api}/api/users/me`, { headers: { Authorization: `Bearer ${access}` } })
      ).json()
    ).data as { emailVerifiedAt: string | null };
  expect((await me()).emailVerifiedAt).toBeNull();

  let token = '';
  await expect
    .poll(
      async () => {
        const found = await request.get(`${mailpit}/api/v1/search`, { params: { query: `to:${email}` } });
        const list = (await found.json()) as { messages?: Array<{ ID: string }> };
        if (!list.messages?.length) return '';
        const msg = await request.get(`${mailpit}/api/v1/message/${list.messages[0].ID}`);
        const text = ((await msg.json()) as { Text?: string }).Text ?? '';
        token = /verify-email\?token=([\w.-]+)/.exec(text)?.[1] ?? '';
        return token;
      },
      { timeout: 30_000 },
    )
    .toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByText('XÁC THỰC THÀNH CÔNG')).toBeVisible({ timeout: 30_000 });
  expect((await me()).emailVerifiedAt).not.toBeNull();

  await page.goto('/verify-email?token=khong-hop-le');
  await expect(page.getByText('XÁC THỰC KHÔNG THÀNH CÔNG')).toBeVisible({ timeout: 30_000 });
});

test('trang 404', async ({ page }) => {
  await page.goto('/khong-co-trang-nay');
  await expect(page.getByText('Ôi! Không tìm thấy trang')).toBeVisible({ timeout: 30_000 });
});

test('khách hàng: đăng nhập → giỏ → mã giảm giá → đặt hàng → chi tiết đơn → đánh giá', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/login');
  await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
  await page.locator('input[name="password"]').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh mục nổi bật' })).toBeVisible({ timeout: 30_000 });

  await visit(page, '/cart', /Giỏ hàng của bạn \(4 sản phẩm\)/);
  await page.getByPlaceholder('Nhập mã giảm giá').fill('GIAM200K');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page.getByText('Đã áp dụng mã GIAM200K')).toBeVisible();

  await page
    .getByRole('link', { name: /Thanh toán/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Thanh toán', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /VNPAY/ }).check();
  await page.getByRole('button', { name: 'Đặt hàng' }).click();
  await expect(page.getByText('Đặt hàng thành công!')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: 'Xem chi tiết đơn hàng' }).click();
  await expect(page.getByRole('heading', { name: /Chi tiết đơn hàng #ALV-/ })).toBeVisible();

  for (const [path, text] of [
    ['/account/profile', 'Thông tin cá nhân'],
    ['/account/orders', 'Đơn hàng của tôi'],
    ['/account/coupons', 'Mã giảm giá của tôi'],
    ['/account/reviews', 'Đánh giá của tôi'],
    ['/account/notifications', 'Thông báo'],
    ['/account/password', 'Đổi mật khẩu'],
    ['/account/returns', 'Đổi trả & hoàn tiền'],
    ['/wishlist', 'Sản phẩm yêu thích'],
  ] as const) {
    await visit(page, path, text);
  }
  await page.goto('/account/orders?tab=completed');
  await page.getByRole('button', { name: 'Đánh giá sản phẩm' }).first().click();
  await page.getByRole('radio', { name: '5 sao' }).click();
  await page
    .getByLabel(/Nội dung đánh giá/)
    .fill('Sản phẩm rất đẹp, chất lượng tốt và giao hàng nhanh chóng.');
  await page.getByRole('button', { name: 'Gửi đánh giá' }).click();
  await expect(page.getByText(/Cảm ơn bạn!/)).toBeVisible();
});

test('phân quyền: khách hàng vào /admin bị chuyển về trang chủ', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
  await page.locator('input[name="password"]').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh mục nổi bật' })).toBeVisible({ timeout: 30_000 });
  await page.goto('/admin');
  await expect(page).toHaveURL(/localhost:\d+\/$/, { timeout: 30_000 });
});

test('admin: đăng nhập và duyệt mọi màn hình quản trị', async ({ page }) => {
  test.setTimeout(480_000);
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
  await page.locator('input[name="password"]').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Tài khoản không có quyền quản trị.')).toBeVisible();
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });

  const pages: Array<[string, string | RegExp]> = [
    ['/admin', 'Tổng quan'],
    ['/admin/products', 'Quản lý danh sách sản phẩm'],
    ['/admin/products/new', 'Thêm sản phẩm'],
    ['/admin/products/1', /Sửa:/],
    ['/admin/spaces', 'Quản lý các không gian'],
    ['/admin/spaces/new', 'Thêm không gian mẫu'],
    ['/admin/spaces/1', /Sửa:/],
    ['/admin/categories', 'Quản lý danh mục'],
    ['/admin/orders', 'Theo dõi và xử lý đơn hàng'],
    ['/admin/returns', 'Duyệt và xử lý yêu cầu đổi trả'],
    ['/admin/customers', 'Quản lý tài khoản khách hàng'],
    ['/admin/customers/2', 'Trần Thu Hà'],
    ['/admin/reviews', 'Duyệt và quản lý đánh giá'],
    ['/admin/questions', 'Trả lời câu hỏi của khách hàng'],
    ['/admin/models', 'Quản lý các mô hình 3D'],
    ['/admin/promotions', 'Tạo và quản lý mã giảm giá'],
    ['/admin/promotions/new', 'Tạo khuyến mãi'],
    ['/admin/content', 'Banner & slider'],
    ['/admin/inventory', 'Theo dõi tồn kho'],
    ['/admin/reports', 'Báo cáo thu chi'],
    ['/admin/settings', 'Cấu hình cửa hàng'],
  ];
  for (const [path, text] of pages) await visit(page, path, text);

  // duyệt đơn: chờ xác nhận → xác nhận
  await page.goto('/admin/orders');
  await page.getByRole('tab', { name: /Chờ xác nhận/ }).click();
  await page.getByRole('link', { name: /#ALV-/ }).first().click();
  await expect(page.getByRole('heading', { name: /Đơn hàng #ALV-/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Xác nhận đơn hàng' }).click();
  await expect(page.getByText('Đã cập nhật trạng thái đơn hàng.')).toBeVisible();
});
