// M12 – Mô hình 3D và AR. Mô hình 3D: tải lên, kiểm tra định dạng/dung lượng, lưu, status ready/failed (xử lý ĐỒNG BỘ, không hàng đợi)
// Module – UC-ADM-13, 14
// Bảng: product_3d_models, model_files, model_material_variants
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminModelsController } from './admin-models.controller';
import { ProductModelsService } from './product-models.service';

@Module({
  controllers: [AdminModelsController],
  providers: [ProductModelsService],
  exports: [ProductModelsService],
})
export class ProductModelsModule {}
