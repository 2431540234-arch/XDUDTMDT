import { test } from '@playwright/test';
import { visit } from './helpers/visit';

// Hồi quy lỗi hydration ở Breadcrumb của /products (KNOWN_ISSUES.md mục 1): Header và ProductListing dùng chung cache
// ['categories']; nếu dữ liệu về trước khi ProductListing hydrate thì client dựng breadcrumb khác HTML máy chủ.
for (const cpuRate of [1, 4]) {
  test(`hydration: /products?category=sofa không lệch HTML máy chủ (CPU ${cpuRate}x)`, async ({ page }) => {
    test.setTimeout(120_000);
    await visit(page, '/products?category=sofa', 'Khám phá các mẫu sofa', { cpuRate });
  });
}
