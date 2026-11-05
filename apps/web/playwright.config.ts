import { defineConfig, devices } from '@playwright/test';

// E2E trình duyệt thật (Chromium). Tự khởi động web dev server ở cổng 3100 (tránh đụng cổng 3000 đang dùng khi dev).
const PORT = 3100;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    // Chạy giao diện với dữ liệu giả (không cần backend)
    env: { NEXT_PUBLIC_USE_MOCK: 'true' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
