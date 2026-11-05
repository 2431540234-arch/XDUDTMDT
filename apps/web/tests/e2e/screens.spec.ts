import { expect, test, type ConsoleMessage, type Page, type Response } from '@playwright/test';

// Duyệt lần lượt các màn hình (chạy với dữ liệu giả): không lỗi console, không request lỗi, không ảnh vỡ.

async function visit(page: Page, path: string, expectText?: string | RegExp) {
  const errors: string[] = [];
  const onConsole = (m: ConsoleMessage) => m.type() === 'error' && errors.push(`console: ${m.text()}`);
  const onPage = (e: Error) => errors.push(`pageerror: ${e.message}`);
  const onResp = (r: Response) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`);
  page.on('console', onConsole);
  page.on('pageerror', onPage);
  page.on('response', onResp);
  // dev server có thể reload khi biên dịch route mới → thử lại một lần nếu điều hướng bị hủy
  await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(async () => {
    await page.waitForTimeout(1500);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  });
  errors.length = 0;
  if (expectText) await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src)
      .map((i) => i.src),
  );
  page.off('console', onConsole);
  page.off('pageerror', onPage);
  page.off('response', onResp);
  expect([...errors, ...broken.map((b) => `ảnh vỡ: ${b}`)], path).toEqual([]);
}

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
  await visit(page, '/reset-password?email=khachhang@aurelia.vn', 'ĐẶT LẠI MẬT KHẨU');
  await visit(page, '/about', 'Giá trị cốt lõi');
  await visit(page, '/contact', 'Liên hệ với chúng tôi');
  await visit(page, '/faq', 'Câu hỏi thường gặp');
  await visit(page, '/policies/chinh-sach-doi-tra', 'Chính sách đổi trả');
  await visit(page, '/wishlist', /Đăng nhập để xem/);
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
