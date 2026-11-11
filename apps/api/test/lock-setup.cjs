// Jest globalSetup (supertest trên aurelia_test): giữ khóa cho tới globalTeardown và dọn thư mục tệp tạm của lần chạy trước
// (test tải mô hình 100 MB, 36 frame… để lại hàng GB nếu không dọn). Chỉ xóa đúng thư mục test .tmp-uploads-db (đã gitignore).
const fs = require('node:fs');
const path = require('node:path');
const { acquire } = require('../../../scripts/test-lock.cjs');

module.exports = async () => {
  globalThis.__releaseTestLock = acquire('supertest (npm run test:e2e:db)');
  fs.rmSync(path.resolve(__dirname, '../.tmp-uploads-db'), { recursive: true, force: true });
};
