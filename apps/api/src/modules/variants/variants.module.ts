// M07 – Sản phẩm, biến thể, tồn kho. Biến thể sản phẩm
// Module – UC-ADM-10
// Bảng: product_variants, variant_attribute_values
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminVariantsController } from './admin-variants.controller';
import { VariantsService } from './variants.service';

@Module({
  controllers: [AdminVariantsController],
  providers: [VariantsService],
  exports: [VariantsService],
})
export class VariantsModule {}
