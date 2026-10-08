// M07 – Sản phẩm, biến thể, tồn kho. Nhập kho và điều chỉnh tồn kho
// Module – UC-ADM-12
// Bảng: inventory_movements, product_variants
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [AdminInventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
