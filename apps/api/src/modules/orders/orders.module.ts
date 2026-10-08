// M09 – Đơn hàng. Đặt hàng, theo dõi, hủy, quản trị đơn
// Module – UC-ORD-01, 02, 03; UC-ADM-20, 21, 22
// Bảng: orders, order_items, order_status_history
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
