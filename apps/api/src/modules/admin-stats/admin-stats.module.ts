// M14 – Thông báo và thống kê quản trị. Thống kê tổng quan, AR và phễu không gian mẫu
// Module – UC-ADM-28, 29
// Bảng: orders, ar_sessions, space_views (tổng hợp)
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';

@Module({
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
