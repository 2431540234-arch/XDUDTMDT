// M07 – Sản phẩm, biến thể, tồn kho. Duyệt, tìm kiếm, chi tiết, quản trị sản phẩm
// Module – UC-CAT-01, 02, 03, 04, 06; UC-ADM-09
// Bảng: products, product_variants, product_images
import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, AdminProductsService],
  exports: [ProductsService, AdminProductsService],
})
export class ProductsModule {}
