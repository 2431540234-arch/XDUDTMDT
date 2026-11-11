// Chạy bước xử lý nền mô hình 3D mẫu trên một DB demo/test ĐÃ CÓ dữ liệu (không reset):
//   DATABASE_URL=postgresql://.../aurelia_demo STORAGE_DRIVER=local npm run db:process-models -w @aurelia-living/api
// Không xóa gì; mô hình lỗi / vượt ngưỡng chỉ được đánh dấu `failed` và liệt kê. Chỉ cho phép aurelia_demo và aurelia_test.
import { processSeedModels } from './seed-models';

const db = /\/([^/?]+)(\?|$)/.exec(process.env.DATABASE_URL ?? '')?.[1];
if (!db || !['aurelia_demo', 'aurelia_test'].includes(db)) {
  console.error(`✖ Từ chối: chỉ chạy trên aurelia_demo hoặc aurelia_test (đang trỏ tới ${db ?? '(trống)'}).`);
  process.exit(1);
}
console.log(`Xử lý mô hình 3D mẫu trên ${db} (storage ${process.env.STORAGE_DRIVER ?? 'minio'})`);
processSeedModels().catch((e) => {
  console.error(e);
  process.exit(1);
});
