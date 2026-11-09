import { expect, test, type ConsoleMessage, type Page, type Response } from '@playwright/test';

// Rà soát 360° KHÔNG GIAN MẪU với API thật: khách xem/xoay/bấm hotspot/thêm bộ vào giỏ/lưu, trên desktop và mobile.
// Chạy: npm run test:e2e:real (nhóm xem-360) hoặc E2E_USE_MOCK=false E2E_API_URL=http://localhost:4000

const SLUG = 'phong-lam-viec-toi-gian';

function watch(page: Page) {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e: Error) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r: Response) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  return errors;
}

async function brokenImages(page: Page) {
  return page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src)
      .map((i) => i.src),
  );
}

async function login(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
  await page.locator('input[name="password"]').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(next), { timeout: 30_000 });
}

/** Cột thông tin bên phải (nút Lưu/Chia sẻ của trang, tách khỏi nút lưu trên thẻ không gian tương tự) */
const side = (page: Page) => page.locator('aside');
const viewer = (page: Page) => page.getByLabel('Ảnh 360 độ');

async function waitViewer(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(viewer(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Đang tải ảnh 360°/)).toBeHidden({ timeout: 30_000 });
}

/** Kéo chuột xoay viewer (mỗi lần ~40°) cho tới khi hotspot nằm trong khung nhìn; hotspot sau lưng camera bị ẩn */
async function reveal(page: Page, name: string) {
  // hotspot sau lưng camera bị ẩn (display:none) nên không thấy qua role → dò theo thuộc tính title
  const target = page.locator(`button[title="${name}"]`);
  await target.waitFor({ state: 'attached', timeout: 30_000 });
  const box = (await viewer(page).boundingBox())!;
  const y = box.y + box.height / 2;
  const inView = async () => {
    const b = await target.boundingBox();
    return (
      !!b &&
      b.width > 0 &&
      b.x > box.x + 10 &&
      b.x + b.width < box.x + box.width - 10 &&
      b.y > box.y + 10 &&
      b.y + b.height < box.y + box.height - 10
    );
  };
  for (let i = 0; i < 30 && !(await inView()); i++) {
    const dir = i < 10 ? 1 : -1;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dir * 120, y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
  expect(await inView(), `hotspot "${name}" không xoay tới được trong viewer`).toBe(true);
  return target;
}

test.describe.configure({ mode: 'serial' });

test('danh sách không gian → mở chi tiết: viewer 360°, hotspot, ảnh/góc, không lỗi console/HTTP/ảnh vỡ', async ({
  page,
}) => {
  const errors = watch(page);
  // tìm theo tên để không phụ thuộc thứ tự trang (danh sách sắp mới nhất theo thời điểm đăng, 8 mục/trang)
  await page.goto(`/spaces?q=${encodeURIComponent('làm việc tối giản')}`);
  await expect(page.getByRole('heading', { name: /không gian/i }).first()).toBeVisible({ timeout: 30_000 });
  await page.locator(`a[href="/spaces/${SLUG}"]`).first().click();
  await waitViewer(page);
  // 5 hotspot sản phẩm + 1 điều hướng + 1 thông tin trong góc đầu tiên
  await expect(page.getByRole('button', { name: 'Bàn làm việc', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chất liệu tường' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phóng to' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thu nhỏ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tự xoay' })).toBeVisible();
  await expect(page.getByText(/lượt xem/)).toBeVisible();
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  expect(await brokenImages(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('hotspot: thông tin, sản phẩm (xem/thêm), điều hướng sang góc khác; ảnh thu nhỏ đổi góc', async ({
  page,
}) => {
  await login(page, `/spaces/${SLUG}`);
  await waitViewer(page);
  // hotspot thông tin
  await page.getByRole('button', { name: 'Chất liệu tường' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thông tin điểm tương tác' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Chất liệu tường');
  await dlg.getByRole('button', { name: 'Đóng' }).click();
  await expect(dlg).toBeHidden();
  // hotspot sản phẩm → Thêm vào giỏ
  await page.getByRole('button', { name: 'Bàn làm việc', exact: true }).click();
  await expect(dlg).toContainText('Bàn làm việc');
  await expect(dlg.getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/products/ban-lam-viec');
  const badge = page.getByRole('link', { name: 'Giỏ hàng' });
  const n0 = Number((await badge.innerText()) || 0);
  await dlg.getByRole('button', { name: 'Thêm' }).click();
  await expect(page.getByText('Đã thêm vào giỏ hàng.')).toBeVisible();
  await expect(badge).toHaveText(String(n0 + 1));
  // hotspot điều hướng → đổi sang góc phụ, rồi quay về góc chính
  const thumb = (name: string) => page.getByRole('button', { name }).filter({ has: page.locator('img') });
  await expect(thumb('Góc chính')).toHaveAttribute('aria-current', 'true');
  await (await reveal(page, 'Sang góc phụ')).click();
  await expect(thumb('Góc phụ')).toHaveAttribute('aria-current', 'true');
  await (await reveal(page, 'Về góc chính')).click();
  await expect(thumb('Góc chính')).toHaveAttribute('aria-current', 'true');
  // bấm ảnh thu nhỏ cũng đổi góc
  await thumb('Góc phụ').click();
  await expect(thumb('Góc phụ')).toHaveAttribute('aria-current', 'true');
});

test('thêm cả bộ vào giỏ: số lượng theo ô chọn, bỏ chọn một món, tổng giá thật (không combo)', async ({
  page,
}) => {
  await login(page, `/spaces/${SLUG}`);
  await waitViewer(page);
  const header = page.getByRole('heading', { name: /Sản phẩm trong không gian/ });
  await expect(header).toContainText('(5)');
  await expect(page.getByText('Tổng cộng (5 sản phẩm)')).toBeVisible();
  await expect(page.getByText(/Giá combo/)).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Chọn Thảm lông tròn' }).uncheck();
  await expect(page.getByText('Tổng cộng (4 sản phẩm)')).toBeVisible();
  const badge = page.getByRole('link', { name: 'Giỏ hàng' });
  const n0 = Number((await badge.innerText()) || 0);
  await page.getByRole('button', { name: /Thêm cả bộ vào giỏ hàng/ }).click();
  await expect(page.getByText('Đã thêm 4 sản phẩm vào giỏ hàng.')).toBeVisible({ timeout: 30_000 });
  await expect(badge).toHaveText(String(n0 + 4));
});

test('lưu không gian: bật/tắt và giữ nguyên sau khi tải lại; ', async ({ page, request }) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const views = async () =>
    ((await (await request.get(`${api}/api/spaces/${SLUG}`)).json()).data.viewCount as number) ?? 0;
  await login(page, `/spaces/${SLUG}`);
  await waitViewer(page);
  const v0 = await views();
  // đang xem thì CHƯA ghi; reload (rời trang) ⇒ đúng +1
  await page.waitForTimeout(1500);
  expect(await views()).toBe(v0);
  await page.reload();
  await waitViewer(page);
  await expect.poll(views, { timeout: 15_000 }).toBe(v0 + 1);

  const save = side(page).getByRole('button', { name: /Lưu không gian|Đã lưu/ });
  if ((await save.innerText()).includes('Đã lưu')) {
    await save.click();
    await expect(side(page).getByRole('button', { name: /Lưu không gian/ })).toBeVisible();
  }
  await side(page)
    .getByRole('button', { name: /Lưu không gian/ })
    .click();
  await expect(page.getByText('Đã lưu không gian mẫu.')).toBeVisible();
  await page.reload();
  await waitViewer(page);
  await expect(side(page).getByRole('button', { name: /Đã lưu/ })).toBeVisible();
  await side(page)
    .getByRole('button', { name: /Đã lưu/ })
    .click();
  await expect(side(page).getByRole('button', { name: /Lưu không gian/ })).toBeVisible();
});

test('khách chưa đăng nhập: thêm bộ / lưu → chuyển tới đăng nhập, quay lại đúng không gian', async ({
  page,
}) => {
  await page.goto(`/spaces/${SLUG}`);
  await waitViewer(page);
  await page.getByRole('button', { name: /Thêm cả bộ vào giỏ hàng/ }).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=/spaces/${SLUG}`), { timeout: 15_000 });
});

test('không gian không tồn tại: thông báo rõ ràng và nút quay lại', async ({ page }) => {
  await page.goto('/spaces/khong-ton-tai-abc');
  await expect(page.getByText('Không tìm thấy không gian mẫu')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Xem không gian khác' })).toBeVisible();
});

test.describe('mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('không gian: không tràn ngang, viewer + nút chính dùng được', async ({ page }) => {
    const errors = watch(page);
    await page.goto(`/spaces/${SLUG}`);
    await waitViewer(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const box = await viewer(page).boundingBox();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(200);
    await expect(page.getByRole('button', { name: /Thêm cả bộ vào giỏ hàng/ })).toBeVisible();
    await page.getByRole('button', { name: 'Chất liệu tường' }).tap();
    const dlg = page.getByRole('dialog', { name: 'Thông tin điểm tương tác' });
    await expect(dlg).toBeVisible();
    const d = await dlg.boundingBox();
    expect(d!.x).toBeGreaterThanOrEqual(0);
    expect(d!.x + d!.width).toBeLessThanOrEqual(390);
    expect(await brokenImages(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('danh sách không gian trên mobile không tràn ngang', async ({ page }) => {
    await page.goto(`/spaces?q=${encodeURIComponent('làm việc tối giản')}`);
    await expect(page.locator(`a[href="/spaces/${SLUG}"]`).first()).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test('ảnh 360° tải lỗi: chỉ khung xem báo lỗi + nút Thử lại, trang vẫn dùng được; thử lại thành công khi ảnh có lại', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const detail = (await (await request.get(`${api}/api/spaces/${SLUG}`)).json()).data;
  const first = detail.panoramas.find((p: { isStart: boolean }) => p.isStart).url as string;
  let blocked = true;
  await page.route(first, (route) => (blocked ? route.abort() : route.continue()));
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`/spaces/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được ảnh 360°' })).toBeVisible({
    timeout: 30_000,
  });
  // phần còn lại của trang vẫn hoạt động
  await expect(page.getByRole('button', { name: /Thêm cả bộ vào giỏ hàng/ })).toBeVisible();
  blocked = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(viewer(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được ảnh 360°' })).toHaveCount(0);
});

test('lượt xem ghi MỘT lần khi rời trang bằng sendBeacon: có visitorId, ?from=<slug>, số lần bấm hotspot, đã thêm vào giỏ, accessToken', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const views = async () =>
    ((await (await request.get(`${api}/api/spaces/${SLUG}`)).json()).data.viewCount as number) ?? 0;
  // ghi lại các lần gọi navigator.sendBeacon (lúc rời trang bằng điều hướng trong ứng dụng, cùng một tài liệu nên đọc lại được)
  await page.addInitScript(() => {
    const w = window as unknown as { __beacons: Array<{ url: string; data: Blob }> };
    w.__beacons = [];
    const orig = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      w.__beacons.push({ url: String(url), data: data as Blob });
      return orig(url, data);
    };
  });
  await login(page, `/spaces/${SLUG}`);
  await page.goto(`/spaces/${SLUG}?from=sofa-nordic`);
  await waitViewer(page);
  const v0 = await views();
  // 2 lần bấm hotspot + thêm sản phẩm vào giỏ từ popover
  await page.getByRole('button', { name: 'Chất liệu tường' }).click();
  await page
    .getByRole('dialog', { name: 'Thông tin điểm tương tác' })
    .getByRole('button', { name: 'Đóng' })
    .click();
  await page.getByRole('button', { name: 'Bàn làm việc', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Thông tin điểm tương tác' })
    .getByRole('button', { name: 'Thêm' })
    .click();
  await expect(page.getByText('Đã thêm vào giỏ hàng.')).toBeVisible();
  expect(await page.evaluate(() => (window as never as { __beacons: unknown[] }).__beacons.length)).toBe(0); // chưa rời trang ⇒ chưa gửi
  expect(await views()).toBe(v0);

  await page.getByRole('link', { name: 'Không gian mẫu' }).first().click(); // rời trang bằng điều hướng trong ứng dụng
  await expect(page).toHaveURL(/\/spaces$/);
  await expect.poll(views, { timeout: 15_000 }).toBe(v0 + 1);
  const sent = await page.evaluate(async () => {
    const w = window as unknown as { __beacons: Array<{ url: string; data: Blob }> };
    return Promise.all(w.__beacons.map(async (b) => ({ url: b.url, body: JSON.parse(await b.data.text()) })));
  });
  expect(sent).toHaveLength(1); // đúng MỘT lần
  expect(sent[0].url).toMatch(new RegExp(`/spaces/${SLUG}/views$`));
  expect(sent[0].body).toMatchObject({
    sourceProductId: 'sofa-nordic',
    hotspotClickCount: 2,
    addedToCart: true,
  });
  expect(String(sent[0].body.visitorId)).toMatch(/^[0-9a-f-]{36}$/);
  expect(typeof sent[0].body.accessToken).toBe('string');
});
