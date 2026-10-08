// M05 – Media và lưu trữ tệp. Tải lên và quản lý tệp (StorageService)
// Module – UC-ADM-04
// Bảng: media
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminMediaController } from './admin-media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [AdminMediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
