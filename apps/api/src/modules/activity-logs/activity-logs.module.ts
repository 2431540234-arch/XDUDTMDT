// M01 – Hệ thống và cấu hình
// Module – UC-ADM-27
// Bảng: activity_logs
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminActivityLogsController } from './admin-activity-logs.controller';

@Module({
  controllers: [AdminActivityLogsController],
})
export class ActivityLogsModule {}
