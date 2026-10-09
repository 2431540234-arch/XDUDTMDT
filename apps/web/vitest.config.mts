import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Test đơn vị và component (jsdom). Test e2e trình duyệt nằm ở tests/e2e (Playwright), không chạy ở đây.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    css: false,
  },
});
