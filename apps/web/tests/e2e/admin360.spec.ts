import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

// Rà soát 360° phía ADMIN với API thật: tải/sửa/xóa ảnh xoay 360° của sản phẩm; tạo/sửa/xóa không gian mẫu
// (5 tab + hotspot) rồi kiểm tra khách thấy đúng. Chạy: npm run test:e2e:real (nhóm xem-360)
// hoặc E2E_USE_MOCK=false E2E_API_URL=http://localhost:4000 (DB demo).

/** PNG hợp lệ w×h một màu (đủ cho kiểm tra chữ ký tệp phía server) */
function png(w: number, h: number, rgb: [number, number, number]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const file = (name: string, buf: Buffer) => ({ name, mimeType: 'image/png', buffer: buf });

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: 'serial' });

// ----------------------------------------------------------------------------- ảnh xoay 360° của sản phẩm
const PRODUCT_ID = 12; // Kệ tivi hiện đại (chưa có 360°); 2 màu: Óc chó, Trắng
const PRODUCT_SLUG = 'ke-tivi-hien-dai';

test('admin: bật 360° cho sản phẩm – tải 4 frame (tự xếp theo tên), tệp quá lớn bị từ chối rõ ràng, lưu', async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto(`/admin/products/${PRODUCT_ID}`);
  await expect(page.getByText(/Sửa:/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: /360/ }).click();
  await expect(page.getByRole('switch', { name: /Bật xem 360°/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('switch', { name: /Bật xem 360°/ }).check();
  await page.getByRole('tab', { name: /Óc chó/ }).click();
  // chạy lại trên DB đã dùng: xóa frame cũ của màu này trước khi tải frame mới
  const clear = page.getByRole('button', { name: 'Xóa toàn bộ frame của màu này' });
  if (await clear.isVisible()) await clear.click();

  const input = page.locator('input[type="file"]').first();
  // tệp quá lớn (giới hạn của máy chủ 2MB/frame) → báo ngay ở trình duyệt, không gửi lên
  await input.setInputFiles({
    name: 'to.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([png(8, 8, [1, 2, 3]), Buffer.alloc(2.5 * 1024 * 1024)]),
  });
  await expect(page.getByText(/vượt quá 2MB/)).toBeVisible();

  // chọn lộn xộn: frame-10, frame-2, frame-1, frame-3 ⇒ sắp theo số: 1,2,3,10
  const colors: Array<[string, [number, number, number]]> = [
    ['frame-10.png', [200, 10, 10]],
    ['frame-2.png', [10, 200, 10]],
    ['frame-1.png', [10, 10, 200]],
    ['frame-3.png', [200, 200, 10]],
  ];
  await input.setInputFiles(colors.map(([n, c]) => file(n, png(64, 48, c))));
  await expect(page.getByText(/4 frame · kéo thả để đổi thứ tự/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Xem trước xoay')).toBeVisible();
  // thứ tự hiển thị: frame đầu chính là tệp frame-1.png (so sánh nội dung tệp đã lưu trên máy chủ)
  const src = (await page.getByAltText('Frame 1').getAttribute('src'))!;
  const saved = await (await page.request.get(src)).body();
  expect(saved.equals(png(64, 48, [10, 10, 200]))).toBe(true);

  await page.getByRole('button', { name: 'Lưu ảnh 360°' }).click();
  await expect(page.getByText('Đã lưu ảnh 360°.')).toBeVisible({ timeout: 30_000 });
  // tải lại: dữ liệu còn nguyên (đã lưu thật vào server)
  await page.reload();
  await page.getByRole('tab', { name: /360/ }).click();
  await page.getByRole('tab', { name: /Óc chó/ }).click();
  await expect(page.getByText(/4 frame · kéo thả để đổi thứ tự/)).toBeVisible({ timeout: 30_000 });
});

test('khách thấy 360° vừa tải: xoay được, 4 góc, không ảnh vỡ; màu chưa có frame vẫn có ảnh thay thế', async ({
  page,
}) => {
  await page.goto(`/products/${PRODUCT_SLUG}/360`);
  const stage = page.getByRole('application', { name: 'Xem sản phẩm 360 độ' });
  await expect(stage).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Đang tải ảnh 360°/)).toBeHidden({ timeout: 30_000 });
  const slider = page.getByRole('slider', { name: 'Góc xoay' });
  await stage.focus();
  await page.keyboard.press('Space'); // dừng tự xoay
  const a0 = Number(await slider.inputValue());
  await page.keyboard.press('ArrowRight');
  expect(Number(await slider.inputValue())).toBe((a0 + 90) % 360); // 4 frame ⇒ mỗi bước = 1 frame = 90°
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src)
      .map((i) => i.src),
  );
  expect(broken).toEqual([]);
});

test('admin: xóa frame của màu + tắt 360° ⇒ khách không còn thấy 360° (thông báo rõ ràng)', async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto(`/admin/products/${PRODUCT_ID}`);
  await page.getByRole('tab', { name: /360/ }).click();
  await page.getByRole('tab', { name: /Óc chó/ }).click();
  await page.getByRole('button', { name: 'Xóa toàn bộ frame của màu này' }).click();
  await page.getByRole('switch', { name: /Bật xem 360°/ }).uncheck();
  await page.getByRole('button', { name: 'Lưu ảnh 360°' }).click();
  await expect(page.getByText('Đã lưu ảnh 360°.')).toBeVisible({ timeout: 30_000 });
  await page.goto(`/products/${PRODUCT_SLUG}/360`);
  await expect(page.getByText(/chưa có ảnh 360|không có ảnh 360|chưa hỗ trợ 360/i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('application', { name: 'Xem sản phẩm 360 độ' })).toHaveCount(0);
});

test('trường hợp lớn nhất: 36 frame × ~1,9 MB (≈68 MB) tải từng tệp, lưu và tải lại đủ 36 frame', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await adminLogin(page);
  await page.goto(`/admin/products/${PRODUCT_ID}`);
  await page.getByRole('tab', { name: /360/ }).click();
  await page.getByRole('switch', { name: /Bật xem 360°/ }).check();
  await page.getByRole('tab', { name: /Óc chó/ }).click();
  // Playwright chỉ nhận buffer tổng ≤ 50 MB ⇒ ghi tệp ra thư mục tạm của test rồi truyền đường dẫn
  const dir = test.info().outputDir;
  mkdirSync(dir, { recursive: true });
  const files = Array.from({ length: 36 }, (_, i) => {
    const p = join(dir, `frame-${String(i + 1).padStart(2, '0')}.png`);
    writeFileSync(
      p,
      Buffer.concat([png(64, 48, [i * 6, 100, 200 - i * 4]), Buffer.alloc(1.9 * 1024 * 1024, i)]),
    );
    return p;
  });
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await expect(page.getByText(/36 frame · kéo thả để đổi thứ tự/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Lưu ảnh 360°' }).click();
  await expect(page.getByText('Đã lưu ảnh 360°.')).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await page.getByRole('tab', { name: /360/ }).click();
  await page.getByRole('tab', { name: /Óc chó/ }).click();
  await expect(page.getByText(/36 frame · kéo thả để đổi thứ tự/)).toBeVisible({ timeout: 30_000 });
  // dọn: xóa frame, tắt 360°
  await page.getByRole('button', { name: 'Xóa toàn bộ frame của màu này' }).click();
  await page.getByRole('switch', { name: /Bật xem 360°/ }).uncheck();
  await page.getByRole('button', { name: 'Lưu ảnh 360°' }).click();
  await expect(page.getByText('Đã lưu ảnh 360°.')).toBeVisible({ timeout: 30_000 });
});

// ----------------------------------------------------------------------------- không gian mẫu (5 tab + hotspot)
const TITLE = 'Phòng thử nghiệm 360 tự động';
let slug = '';

test('admin: tạo không gian – thông tin, 2 ảnh 360°, hotspot sản phẩm/điều hướng/thông tin, sản phẩm gợi ý, hiển thị', async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto('/admin/spaces/new');
  await expect(page.getByLabel(/Tên không gian/)).toBeVisible({ timeout: 30_000 });

  // thiếu trường bắt buộc ⇒ báo lỗi, không lưu
  await page.getByRole('button', { name: 'Lưu không gian' }).click();
  await expect(page.getByText('Vui lòng nhập tên không gian.')).toBeVisible();

  await page.getByLabel(/Tên không gian/).fill(TITLE);
  await page.getByLabel(/Loại không gian/).selectOption({ label: 'Phòng khách' });
  await page.getByLabel(/Phong cách/).selectOption({ label: 'Hiện đại' });
  await page.getByLabel(/Mô tả/).fill('Không gian tạo bởi kiểm thử tự động để rà soát luồng 360°.');

  // tab Ảnh 360°: 2 ảnh 2:1
  await page.getByRole('tab', { name: 'Ảnh 360°' }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      file('goc-1.png', png(128, 64, [180, 150, 120])),
      file('goc-2.png', png(128, 64, [90, 120, 160])),
    ]);
  await expect(page.getByAltText('Góc 1')).toBeVisible();
  await expect(page.getByAltText('Góc 2')).toBeVisible();
  await page.getByLabel('Tên góc').nth(1).fill('Góc cửa sổ');

  // tab hotspot: 3 điểm trên góc 1
  await page.getByRole('tab', { name: /Điểm tương tác/ }).click();
  const pad = page.getByRole('application', { name: 'Đặt điểm tương tác trên ảnh 360°' });
  const box = (await pad.boundingBox())!;
  await pad.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } });
  await page.getByLabel('Loại điểm').selectOption('product');
  await page.getByLabel('Sản phẩm', { exact: true }).selectOption({ label: 'Sofa Nordic' });
  await pad.click({ position: { x: box.width * 0.6, y: box.height * 0.5 } });
  await page.getByLabel('Loại điểm').selectOption('navigation');
  await page.getByLabel('Đến ảnh').selectOption({ index: 1 });
  await page.getByLabel('Tiêu đề').fill('Sang góc cửa sổ');
  await pad.click({ position: { x: box.width * 0.85, y: box.height * 0.4 } });
  await page.getByLabel('Loại điểm').selectOption('info');
  await page.getByLabel('Tiêu đề').fill('Sàn gỗ');
  await page.getByLabel('Nội dung').fill('Sàn gỗ sồi tự nhiên.');
  await expect(page.getByRole('button', { name: 'Điểm 3' })).toBeVisible();

  // tab sản phẩm gợi ý: 2 sản phẩm
  await page.getByRole('tab', { name: /Sản phẩm gợi ý/ }).click();
  await page.getByRole('checkbox', { name: /Sofa Nordic/ }).check();
  await page.getByRole('checkbox', { name: /Kệ tivi hiện đại/ }).check();
  await expect(page.getByText('Đã chọn 2 sản phẩm')).toBeVisible();

  // tab hiển thị
  await page.getByRole('tab', { name: /Cài đặt hiển thị/ }).click();
  await page.getByLabel('Trạng thái hiển thị').selectOption('published');

  await page.getByRole('button', { name: 'Lưu không gian' }).click();
  await expect(page.getByText('Đã thêm không gian mẫu.')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/admin\/spaces$/, { timeout: 15_000 });
  await page.getByPlaceholder('Tìm theo tên không gian…').fill(TITLE);
  await expect(page.getByRole('row', { name: new RegExp(TITLE) })).toBeVisible({ timeout: 30_000 });
});

test('khách thấy không gian mới: 2 góc, hotspot đúng loại, tổng giá, sản phẩm gợi ý', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const list = (await (await request.get(`${api}/api/spaces?pageSize=100`)).json()).data as Array<{
    slug: string;
    title: string;
  }>;
  slug = list.find((s) => s.title === TITLE)?.slug ?? '';
  expect(slug, 'không gian mới phải có trong danh sách công khai').not.toBe('');
  await page.goto(`/spaces/${slug}`);
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Ảnh 360 độ')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Đang tải ảnh 360°/)).toBeHidden({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Sản phẩm trong không gian \(2\)/ })).toBeVisible();
  await expect(page.getByText('Tổng cộng (2 sản phẩm)')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Góc cửa sổ' }).filter({ has: page.locator('img') }),
  ).toBeVisible();
  const detail = (await (await request.get(`${api}/api/spaces/${slug}`)).json()).data;
  const types = detail.panoramas[0].hotspots.map((h: { type: string }) => h.type).sort();
  expect(types).toEqual(['info', 'navigation', 'product', 'product']); // 2 sản phẩm gợi ý ⇒ mỗi sản phẩm đều có điểm trên ảnh đầu
  expect(
    detail.panoramas[0].hotspots.find((h: { type: string }) => h.type === 'navigation').targetPanoramaId,
  ).toBe(detail.panoramas[1].id);
});

test('admin: sửa không gian (đổi tên, bỏ một sản phẩm) rồi xóa ⇒ khách nhận 404', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const search = 'Tìm theo tên không gian…';
  await adminLogin(page);
  await page.goto('/admin/spaces');
  await page.getByPlaceholder(search).fill(TITLE);
  const row = page.getByRole('row', { name: new RegExp(TITLE) });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(page.getByLabel(/Tên không gian/)).toHaveValue(TITLE, { timeout: 30_000 });
  await page.getByLabel(/Tên không gian/).fill(`${TITLE} (đã sửa)`);
  await page.getByRole('tab', { name: /Sản phẩm gợi ý/ }).click();
  await page.getByRole('checkbox', { name: /Kệ tivi hiện đại/ }).uncheck();
  await page.getByRole('button', { name: 'Lưu không gian' }).click();
  await expect(page.getByText('Đã cập nhật không gian mẫu.')).toBeVisible({ timeout: 30_000 });
  // đổi tên KHÔNG đổi slug: liên kết cũ vẫn mở được
  const detail = (await (await request.get(`${api}/api/spaces/${slug}`)).json()).data;
  expect(detail.title).toBe(`${TITLE} (đã sửa)`);
  expect(detail.products).toHaveLength(1);
  // bỏ sản phẩm khỏi bộ ⇒ điểm tương tác của sản phẩm đó cũng biến mất; các điểm còn lại giữ nguyên
  const kinds = detail.panoramas[0].hotspots.map((h: { type: string }) => h.type).sort();
  expect(kinds).toEqual(['info', 'navigation', 'product']);

  // xóa
  await page.goto('/admin/spaces');
  await page.getByPlaceholder(search).fill(TITLE);
  const row2 = page.getByRole('row', { name: /đã sửa/ });
  await expect(row2).toBeVisible({ timeout: 30_000 });
  await row2.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa', exact: true }).click();
  // Chờ KẾT QUẢ xóa (thông báo hiện sau khi máy chủ đã xóa xong). Không dùng `toHaveCount(0)` của hàng làm điều kiện chờ: khi hộp thoại
  // mở, nền bị aria-hidden nên hàng "biến mất" khỏi cây truy cập ngay lập tức, trước khi yêu cầu xóa kịp hoàn tất (nguyên nhân flake cũ).
  await expect(page.getByText('Đã xóa không gian mẫu.')).toBeVisible({ timeout: 30_000 });
  await expect(row2).toHaveCount(0, { timeout: 30_000 });
  expect((await request.get(`${api}/api/spaces/${slug}`)).status()).toBe(404);
});
