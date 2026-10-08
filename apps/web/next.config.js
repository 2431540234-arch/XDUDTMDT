const path = require('node:path');
const { loadEnvConfig } = require('@next/env');

// Dùng MỘT file .env duy nhất ở gốc monorepo (Next mặc định chỉ đọc apps/web/.env)
loadEnvConfig(path.resolve(__dirname, '../..'), process.env.NODE_ENV !== 'production', console, true);

// Dừng ngay lúc khởi động (dev/build/start) nếu thiếu biến bắt buộc
if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    '[web] Thiếu biến môi trường NEXT_PUBLIC_API_URL (ví dụ http://localhost:4000). Xem .env.example và sao chép thành .env ở thư mục gốc.',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@aurelia-living/shared-types'],
};

module.exports = nextConfig;
