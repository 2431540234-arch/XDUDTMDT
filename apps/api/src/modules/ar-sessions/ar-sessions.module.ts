// M12 – Mô hình 3D và AR. Ghi nhận phiên 3D/AR ẩn danh
// Module – UC-3D-07
// Bảng: ar_sessions
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { ArSessionsController } from './ar-sessions.controller';
import { ArSessionsService } from './ar-sessions.service';

@Module({
  controllers: [ArSessionsController],
  providers: [ArSessionsService],
  exports: [ArSessionsService],
})
export class ArSessionsModule {}
