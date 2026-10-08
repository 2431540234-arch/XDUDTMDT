// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Thuộc tính và giá trị thuộc tính
// Module – UC-ADM-08
// Bảng: attributes, attribute_values
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminAttributesController } from './admin-attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  controllers: [AdminAttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
