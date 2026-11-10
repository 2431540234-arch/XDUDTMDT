const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { PHASE_PRODUCTION_BUILD } = require('next/constants');

// Dùng MỘT file .env duy nhất ở gốc monorepo (Next mặc định chỉ đọc apps/web/.env)
loadEnvConfig(path.resolve(__dirname, '../..'), process.env.NODE_ENV !== 'production', console, true);

// Dừng ngay lúc khởi động (dev/build/start) nếu thiếu biến bắt buộc
// Chế độ dữ liệu giả (NEXT_PUBLIC_USE_MOCK=true) không cần địa chỉ API thật
if (!process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_USE_MOCK !== 'true') {
  throw new Error(
    '[web] Thiếu biến môi trường NEXT_PUBLIC_API_URL (ví dụ http://localhost:4000). Xem .env.example và sao chép thành .env ở thư mục gốc.',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Thư mục build riêng cho e2e (NEXT_DIST_DIR) để chạy Playwright không đè lên server dev đang dùng .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@aurelia-living/shared-types'],
};

// Bản build production (next build) KHÔNG được nhúng chế độ dữ liệu giả: NEXT_PUBLIC_USE_MOCK được cố định vào mã lúc build,
// build với =true sẽ phát hành một giao diện không gọi API thật. Dev (next dev) và e2e vẫn dùng mock được.
module.exports = (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
    throw new Error(
      '[web] NEXT_PUBLIC_USE_MOCK=true bị CẤM khi build production (next build). Đặt NEXT_PUBLIC_USE_MOCK=false và NEXT_PUBLIC_API_URL.',
    );
  }
  return nextConfig;
};
