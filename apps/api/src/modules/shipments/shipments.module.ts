// M10 – Vận chuyển (admin nhập tay). Module – UC-ADM-25. Bảng: shipments
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminShipmentsController } from './admin-shipments.controller';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [OrdersModule],
  controllers: [AdminShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
