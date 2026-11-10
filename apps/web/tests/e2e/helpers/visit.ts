import { expect, type ConsoleMessage, type Page, type Response } from '@playwright/test';

/**
 * Chờ hydrate xong: các phần tử chính (main, h1, breadcrumb) đã được React gắn fiber (`__reactFiber$…`). Nội dung trong
 * <Suspense> hydrate muộn hơn phần còn lại; lỗi hydration (nếu có) được báo NGAY lúc đó, nên phải chờ xong rồi mới kết luận.
 */
export async function waitHydrated(page: Page) {
  await page
    .waitForFunction(
      () => {
        const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber$'));
        const els = Array.from(document.querySelectorAll('main, h1, nav[aria-label="Breadcrumb"]'));
        return els.length > 0 && els.every(hydrated);
      },
      undefined,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(500); // effect/cập nhật React Query ngay sau hydrate
}

/**
 * Duyệt một màn hình: không lỗi console/pageerror (kể cả hydration), không request lỗi, không ảnh vỡ.
 * Bộ bắt lỗi đăng ký và xóa TRƯỚC khi điều hướng (trước đây xóa SAU goto nên bỏ sót lỗi hydration đến sớm).
 * `cpuRate` > 1 làm chậm CPU của trang bằng CDP (mô phỏng máy chậm), không cần tiến trình nền.
 */
export async function visit(
  page: Page,
  path: string,
  expectText?: string | RegExp,
  opts: { cpuRate?: number } = {},
) {
  const errors: string[] = [];
  const onConsole = (m: ConsoleMessage) => m.type() === 'error' && errors.push(`console: ${m.text()}`);
  const onPage = (e: Error) => errors.push(`pageerror: ${e.message}`);
  const onResp = (r: Response) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`);
  page.on('console', onConsole);
  page.on('pageerror', onPage);
  page.on('response', onResp);
  if (opts.cpuRate && opts.cpuRate > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpuRate });
  }
  errors.length = 0; // reset TRƯỚC goto
  // dev server có thể reload khi biên dịch route mới → thử lại một lần nếu điều hướng bị hủy
  await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(async () => {
    await page.waitForTimeout(1500);
    errors.length = 0;
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  });
  if (expectText) await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await waitHydrated(page);
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src)
      .map((i) => i.src),
  );
  page.off('console', onConsole);
  page.off('pageerror', onPage);
  page.off('response', onResp);
  // soft: liệt kê MỌI trang lỗi trong một lượt thay vì dừng ở trang đầu tiên
  expect.soft([...errors, ...broken.map((b) => `ảnh vỡ: ${b}`)], path).toEqual([]);
}
