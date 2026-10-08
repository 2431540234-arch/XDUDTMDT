// M13 – Không gian mẫu 360°. Ảnh panorama 360°
// Module – UC-ADM-15
// Bảng: space_panoramas
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminPanoramasController } from './admin-panoramas.controller';
import { PanoramasService } from './panoramas.service';

@Module({
  controllers: [AdminPanoramasController],
  providers: [PanoramasService],
  exports: [PanoramasService],
})
export class PanoramasModule {}
