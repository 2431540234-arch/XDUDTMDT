// M14 – Thông báo và thống kê quản trị. Thống kê tổng quan
// Module – UC-ADM-28, 29
// Bảng: orders (tổng hợp)
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminMiscController } from './admin-misc.controller';
import { AdminMiscService } from './admin-misc.service';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminFinanceService } from './admin-finance.service';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';

@Module({
  imports: [OrdersModule],
  controllers: [AdminStatsController, AdminMiscController, AdminFinanceController],
  providers: [AdminStatsService, AdminMiscService, AdminFinanceService],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
