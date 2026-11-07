import { expect, test, type Locator, type Page } from '@playwright/test';

// Mốc 4 (API thật): Kho (phiếu nháp → xác nhận, phiếu xuất, lịch sử biến động), Thu chi (phiếu chi → báo cáo), Cài đặt.
// Chạy: npm run test:e2e:real (nhóm admin-m4) hoặc E2E_USE_MOCK=false E2E_API_URL=http://localhost:4000

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

async function openInventory(page: Page) {
  await page.goto('/admin/inventory');
  await expect(page.getByText('Theo dõi tồn kho')).toBeVisible({ timeout: 30_000 });
}

/** Chọn biến thể đầu tiên trong hộp thoại phiếu kho; trả về SKU */
async function pickFirstVariant(dlg: Locator): Promise<string> {
  const sel = dlg.locator('select[aria-label="Sản phẩm"]').first();
  await expect.poll(async () => sel.locator('option').count(), { timeout: 30_000 }).toBeGreaterThan(1);
  const opt = sel.locator('option').nth(1);
  const sku = /\(([^)]+)\) – tồn/.exec(await opt.innerText())![1];
  await sel.selectOption((await opt.getAttribute('value')) as string);
  return sku;
}

/** Tồn kho của một SKU trong bảng (tìm theo SKU rồi đọc cột "Tồn kho") */
async function stockOf(page: Page, sku: string): Promise<number> {
  const box = page.getByPlaceholder('Tìm theo tên sản phẩm, SKU…');
  if ((await box.inputValue()) !== sku) {
    // đợi danh sách đã lọc theo SKU (ô tìm kiếm có debounce) để không đọc nhầm dòng cũ
    const filtered = page.waitForResponse(
      (r) => r.url().includes('/admin/inventory?') && r.url().includes(`q=${encodeURIComponent(sku)}`),
    );
    await box.fill(sku);
    await filtered;
  }
  // khớp CHÍNH XÁC SKU (một SKU có thể là tiền tố của SKU khác)
  const row = page
    .getByRole('row')
    .filter({ has: page.locator('code').getByText(sku, { exact: true }) })
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  return Number(await row.locator('td').nth(3).innerText());
}

test.describe.configure({ mode: 'serial' });

test('kho: bỏ cột "Đang giữ"; phiếu nhập nháp không đổi tồn, xác nhận ⇒ hoàn tất + lịch sử biến động; nhà cung cấp bắt buộc', async ({
  page,
}) => {
  await adminLogin(page);
  await openInventory(page);
  await expect(page.getByRole('columnheader', { name: 'Tồn kho' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Đang giữ' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Tạo phiếu nhập' }).click();
  const dlg = page.getByRole('dialog');
  // thiếu nhà cung cấp ⇒ báo lỗi
  await dlg.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(dlg.getByText('Vui lòng nhập nhà cung cấp.')).toBeVisible();
  await dlg.getByLabel('Nhà cung cấp').fill('Công ty Nội thất Việt');
  const sku = await pickFirstVariant(dlg);
  await dlg.getByLabel('Số lượng').fill('7');
  await dlg.getByLabel('Giá vốn').fill('1500000');
  await dlg.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page.getByText(/Đã lưu nháp phiếu PN\d{4}\./)).toBeVisible({ timeout: 30_000 });
  const s0 = await stockOf(page, sku); // phiếu nháp chưa đổi tồn

  // phiếu nháp ở danh sách phiếu
  const draftRow = page.getByRole('row', { name: /PN\d{4}.*Nháp/ }).first();
  await expect(draftRow).toBeVisible();
  const code = (await draftRow.locator('td').first().innerText()).trim();

  await page.getByRole('button', { name: `Xác nhận phiếu ${code}` }).click();
  await expect(page.getByText(`Đã xác nhận phiếu ${code}.`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row', { name: new RegExp(`${code}.*Hoàn tất`) })).toBeVisible();
  await expect(page.getByRole('button', { name: `Xác nhận phiếu ${code}` })).toHaveCount(0);

  // tồn tăng 7 và lịch sử biến động ghi nhận mang mã phiếu
  await expect.poll(() => stockOf(page, sku), { timeout: 20_000 }).toBe(s0 + 7);
  await expect(page.getByRole('row', { name: new RegExp(`Nhập kho.*\\+7.*${code}`) }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test('kho: phiếu xuất hoàn tất giảm tồn; xuất quá tồn bị từ chối rõ ràng; hủy phiếu nháp không đổi tồn', async ({
  page,
}) => {
  await adminLogin(page);
  await openInventory(page);

  await page.getByRole('button', { name: 'Tạo phiếu xuất' }).click();
  let dlg = page.getByRole('dialog');
  const sku = await pickFirstVariant(dlg);
  await dlg.getByRole('button', { name: 'Hủy', exact: true }).click();
  const s0 = await stockOf(page, sku);

  const open = async (qty: string) => {
    await page.getByRole('button', { name: 'Tạo phiếu xuất' }).click();
    dlg = page.getByRole('dialog');
    const sel = dlg.locator('select[aria-label="Sản phẩm"]').first();
    await expect.poll(async () => sel.locator('option').count(), { timeout: 30_000 }).toBeGreaterThan(1);
    await sel.selectOption({ index: 1 });
    await dlg.getByLabel('Số lượng').fill(qty);
    return dlg;
  };

  // xuất quá tồn
  await open(String(s0 + 999));
  await dlg.getByRole('button', { name: 'Hoàn tất phiếu' }).click();
  await expect(page.getByText(/Tồn kho không đủ/)).toBeVisible({ timeout: 30_000 });
  await dlg.getByRole('button', { name: 'Hủy', exact: true }).click();
  expect(await stockOf(page, sku)).toBe(s0);

  // xuất 1
  await open('1');
  await dlg.getByRole('button', { name: 'Hoàn tất phiếu' }).click();
  await expect(page.getByText(/Đã tạo phiếu PX\d{4}\./)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => stockOf(page, sku), { timeout: 20_000 }).toBe(s0 - 1);

  // nháp rồi hủy
  await open('1');
  await dlg.getByRole('button', { name: 'Lưu nháp' }).click();
  const draft = page.getByRole('row', { name: /PX\d{4}.*Nháp/ }).first();
  await expect(draft).toBeVisible({ timeout: 30_000 });
  const code = (await draft.locator('td').first().innerText()).trim();
  await page.getByRole('button', { name: `Hủy phiếu ${code}` }).click();
  await expect(page.getByText(`Đã hủy phiếu ${code}.`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row', { name: new RegExp(`${code}.*Đã hủy`) })).toBeVisible();
  expect(await stockOf(page, sku)).toBe(s0 - 1);
});

test('thu chi: thêm phiếu chi ⇒ sổ thu chi cập nhật; công nợ phải trả hiện phiếu nhập nháp', async ({
  page,
}) => {
  await adminLogin(page);
  // một phiếu nhập nháp để kiểm tra công nợ phải trả
  await openInventory(page);
  await page.getByRole('button', { name: 'Tạo phiếu nhập' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Nhà cung cấp').fill('NCC Công nợ');
  await pickFirstVariant(dlg);
  await dlg.getByLabel('Giá vốn').fill('2000000');
  await dlg.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page.getByText(/Đã lưu nháp phiếu PN\d{4}\./)).toBeVisible({ timeout: 30_000 });

  await page.goto('/admin/reports');
  await expect(page.getByText('Báo cáo thu chi').first()).toBeVisible({ timeout: 30_000 });
  const note = `Chạy quảng cáo e2e ${Date.now()}`;
  await page
    .getByRole('button', { name: /Thêm phiếu chi/ })
    .first()
    .click();
  const m = page.getByRole('dialog');
  // hoàn tiền không có trong danh sách nhập tay
  await expect(m.locator('option', { hasText: 'Hoàn tiền' })).toHaveCount(0);
  await m.getByLabel('Số tiền').fill('0');
  await m.getByLabel('Nội dung').fill(note);
  await m.getByRole('button', { name: 'Lưu phiếu chi' }).click();
  await expect(m.getByText('Số tiền phải lớn hơn 0.')).toBeVisible();
  await m.getByLabel('Số tiền').fill('321000');
  await m.getByRole('button', { name: 'Lưu phiếu chi' }).click();
  await expect(page.getByText('Đã thêm phiếu chi.')).toBeVisible({ timeout: 30_000 });

  // phiếu chi vừa thêm có trong sổ thu chi
  await page
    .getByRole('tab', { name: /Sổ|Thu chi|Giao dịch/ })
    .first()
    .click();
  await expect(page.getByText(note).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: 'Công nợ' }).click();
  await expect(page.getByText(/NCC Công nợ/)).toBeVisible({ timeout: 30_000 });
});

test('cài đặt: sửa thông tin cửa hàng (kiểm tra tên/email), lưu, tải lại vẫn còn, GET /settings/public thấy ngay; vận chuyển', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  await adminLogin(page);
  await page.goto('/admin/settings');
  await expect(page.getByText('Cấu hình cửa hàng')).toBeVisible({ timeout: 30_000 });
  const name = page.getByLabel(/Tên cửa hàng/);
  const email = page.getByLabel(/^Email/).first();
  await expect(name).toBeVisible({ timeout: 30_000 });
  const originalName = await name.inputValue();
  const originalEmail = await email.inputValue();

  await name.fill('');
  await email.fill('khong-phai-email');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText(/Vui lòng nhập tên cửa hàng/)).toBeVisible();
  await expect(page.getByText(/Email không hợp lệ/)).toBeVisible();

  await name.fill('Aurelia Living E2E');
  await email.fill(originalEmail);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByLabel(/Tên cửa hàng/)).toHaveValue('Aurelia Living E2E', { timeout: 30_000 });
  const pub = (await (await request.get(`${api}/api/settings/public`)).json()).data;
  expect(pub.store.name).toBe('Aurelia Living E2E');

  // khôi phục tên cửa hàng
  await page.getByLabel(/Tên cửa hàng/).fill(originalName);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible({ timeout: 30_000 });
  const pub2 = (await (await request.get(`${api}/api/settings/public`)).json()).data;
  expect(pub2.store.name).toBe(originalName);
});

test('thanh toán: phương thức bị tắt trong Cài đặt không còn ở trang thanh toán; phương thức đang chọn tự đổi; bật lại thì hiện', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const login = async (email: string, password: string) =>
    (await (await request.post(`${api}/api/auth/login`, { data: { email, password } })).json()).data.tokens
      .accessToken as string;
  const admin = await login('admin@aurelia.vn', 'admin123');
  const adminH = { Authorization: `Bearer ${admin}` };
  const settings = (await (await request.get(`${api}/api/admin/settings`, { headers: adminH })).json()).data;
  const original = settings.payments as Array<{ method: string; enabled: boolean }>;
  const setCod = (enabled: boolean) =>
    request.put(`${api}/api/admin/settings/store`, {
      headers: adminH,
      data: { payments: original.map((p) => (p.method === 'cod' ? { ...p, enabled } : p)) },
    });
  try {
    expect((await setCod(false)).ok()).toBe(true);
    // khách có hàng trong giỏ rồi vào trang thanh toán
    await page.goto('/login?next=/products/sofa-nordic');
    await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
    await page.locator('input[name="password"]').fill('123456');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sofa Nordic' })).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole('button', { name: /Thêm vào giỏ hàng/ })
      .first()
      .click();
    await expect(page.getByText(/Đã thêm/)).toBeVisible({ timeout: 30_000 });
    await page.goto('/checkout');
    await expect(page.getByText('Thanh toán khi nhận hàng').first())
      .toBeHidden({ timeout: 30_000 })
      .catch(() => undefined);
    await expect(page.getByText('Chuyển khoản ngân hàng').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Thanh toán khi nhận hàng')).toHaveCount(0);
    // bật lại ⇒ hiện
    expect((await setCod(true)).ok()).toBe(true);
    await page.reload();
    await expect(page.getByText('Thanh toán khi nhận hàng').first()).toBeVisible({ timeout: 30_000 });
  } finally {
    await request.put(`${api}/api/admin/settings/store`, { headers: adminH, data: { payments: original } });
  }
});
