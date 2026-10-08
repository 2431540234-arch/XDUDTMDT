// M13 – Không gian mẫu 360°. Điểm tương tác trên ảnh 360°
// Module – UC-ADM-16
// Bảng: space_hotspots
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminHotspotsController } from './admin-hotspots.controller';
import { HotspotsService } from './hotspots.service';

@Module({
  controllers: [AdminHotspotsController],
  providers: [HotspotsService],
  exports: [HotspotsService],
})
export class HotspotsModule {}
