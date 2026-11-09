// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Danh mục sản phẩm
// Module – UC-CAT-02 (cây danh mục); UC-ADM-05
// Bảng: categories
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { ProductsModule } from '../products/products.module';
import { AdminCategoriesService } from './admin-categories.service';
import { CategoriesService } from './categories.service';

@Module({
  imports: [ProductsModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService, AdminCategoriesService],
  exports: [CategoriesService, AdminCategoriesService],
})
export class CategoriesModule {}
