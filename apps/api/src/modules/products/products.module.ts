// M07 – Sản phẩm, biến thể, tồn kho. Duyệt, tìm kiếm, chi tiết, xem 360°, quản trị sản phẩm
// Module – UC-CAT-01, 02, 03, 04, 06; UC-ADM-09
// Bảng: products, product_variants, product_images, product_360_configs, product_360_frames, product_specs
import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { Product360Service } from './product-360.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, Product360Service],
  exports: [ProductsService, Product360Service],
})
export class ProductsModule {}
