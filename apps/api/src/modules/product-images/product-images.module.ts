// M07 – Sản phẩm, biến thể, tồn kho. Ảnh sản phẩm
// Module – UC-ADM-11
// Bảng: product_images
import { Module } from '@nestjs/common';
import { AdminProductImagesController } from './admin-product-images.controller';
import { ProductImagesService } from './product-images.service';

@Module({
  controllers: [AdminProductImagesController],
  providers: [ProductImagesService],
  exports: [ProductImagesService],
})
export class ProductImagesModule {}
