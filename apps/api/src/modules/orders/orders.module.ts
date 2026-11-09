// M09 – Đơn hàng. Đặt hàng, theo dõi, hủy, quản trị đơn
// Module – UC-ORD-01, 02, 03; UC-ADM-20, 21, 22
// Bảng: orders, order_items, order_status_history
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';
import { UsersModule } from '../users/users.module';
import { AdminOrdersService } from './admin-orders.service';
import { OrderViewsService } from './order-views.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, CouponsModule, UsersModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderViewsService, AdminOrdersService],
  exports: [OrdersService, OrderViewsService, AdminOrdersService],
})
export class OrdersModule {}
