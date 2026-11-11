// M12 – Mô hình 3D và AR. Mô hình 3D: tải lên, kiểm tra định dạng/dung lượng, lưu, status ready/failed (xử lý ĐỒNG BỘ, không hàng đợi)
// Module – UC-ADM-13, 14
// Bảng: product_3d_models, model_files, model_material_variants
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AdminModelCatalogService } from './admin-model-catalog.service';
import { AdminModelsController } from './admin-models.controller';
import { ModelMaterialsService } from './model-materials.service';
import { ProductModelsService } from './product-models.service';

@Module({
  imports: [ProductsModule],
  controllers: [AdminModelsController],
  providers: [ProductModelsService, AdminModelCatalogService, ModelMaterialsService],
  exports: [ProductModelsService, AdminModelCatalogService],
})
export class ProductModelsModule {}
