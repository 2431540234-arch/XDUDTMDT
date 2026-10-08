// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Danh mục sản phẩm
// Module – UC-CAT-02 (cây danh mục); UC-ADM-05
// Bảng: categories
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
