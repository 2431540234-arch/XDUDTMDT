import { defineConfig, devices } from '@playwright/test';

// E2E trình duyệt thật (Chromium). Tự khởi động web dev server ở cổng 3100 (tránh đụng cổng 3000 đang dùng khi dev).
const PORT = Number(process.env.E2E_PORT ?? 3100);
// E2E_USE_MOCK=false + E2E_API_URL=http://localhost:4001 → chạy toàn bộ test với API thật (Giai đoạn 11 của BE)
const USE_MOCK = process.env.E2E_USE_MOCK ?? 'true';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Máy chủ CI không có GPU: ép WebGL chạy bằng phần mềm (SwiftShader) để phòng 360° và mô hình 3D (React Three Fiber) vẽ được.
        // Không có các cờ này thì <canvas> không tạo được ngữ cảnh WebGL và các test xem không gian/đặt mô hình 3D báo "không thấy phần tử".
        launchOptions: {
          args: [
            '--use-angle=swiftshader',
            '--use-gl=angle',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    // Mặc định chạy giao diện với dữ liệu giả (không cần backend)
    env: {
      // Next dev tự vá package-lock.json bằng npm (lỗi 'reading os' trong workspaces) – tắt bước này cho test
      NEXT_IGNORE_INCORRECT_LOCKFILE: '1',
      NEXT_PUBLIC_USE_MOCK: USE_MOCK,
      ...(process.env.E2E_API_URL ? { NEXT_PUBLIC_API_URL: process.env.E2E_API_URL } : {}),
      ...(process.env.E2E_DIST_DIR ? { NEXT_DIST_DIR: process.env.E2E_DIST_DIR } : {}),
    },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
