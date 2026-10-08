// M10 – Thanh toán và vận chuyển. Vận chuyển (admin nhập tay)
// Module – UC-ADM-25
// Bảng: shipments
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminShipmentsController } from './admin-shipments.controller';
import { ShipmentsService } from './shipments.service';

@Module({
  controllers: [AdminShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
