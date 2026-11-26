// Liệt kê ảnh thật đã chuyển trong public/mock/photos (CommonJS: dùng bởi next.config.js và seed-mock của API).
// Trả về chuỗi "products/<slug>/<file>.webp,spaces/<slug>/<file>.webp,…"; rỗng ⇒ dữ liệu mẫu dùng ảnh minh họa.
// REAL_PHOTOS=off: ép dùng ảnh minh họa dù máy có ảnh.
const fs = require('node:fs');
const path = require('node:path');

const PHOTO_DIR = path.resolve(__dirname, '../public/mock/photos');

function listMockPhotos(dir = PHOTO_DIR) {
  if (process.env.REAL_PHOTOS === 'off' || !fs.existsSync(dir)) return '';
  return fs
    .readdirSync(dir, { recursive: true })
    .map((f) => String(f).split(path.sep).join('/'))
    .filter((f) => f.endsWith('.webp'))
    .sort()
    .join(',');
}

module.exports = { listMockPhotos };
