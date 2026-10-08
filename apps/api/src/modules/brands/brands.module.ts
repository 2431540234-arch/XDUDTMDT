// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Thương hiệu
// Module – UC-ADM-06
// Bảng: brands
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminBrandsController } from './admin-brands.controller';
import { BrandsService } from './brands.service';

@Module({
  controllers: [AdminBrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
