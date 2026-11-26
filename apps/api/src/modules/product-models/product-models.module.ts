// M12 – Mô hình 3D: tải lên / tạo bằng AI → chuẩn hóa (nền) → admin duyệt → khách thấy.
import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AdminModelCatalogService } from './admin-model-catalog.service';
import { AdminModelsController } from './admin-models.controller';
import { ModelMaterialsService } from './model-materials.service';
import { ModelReviewService } from './model-review.service';
import { ProductModelsService } from './product-models.service';

@Module({
  imports: [ProductsModule],
  controllers: [AdminModelsController],
  providers: [ProductModelsService, AdminModelCatalogService, ModelMaterialsService, ModelReviewService],
  exports: [ProductModelsService, AdminModelCatalogService, ModelReviewService],
})
export class ProductModelsModule {}
