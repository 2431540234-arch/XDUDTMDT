// M05 – Media và lưu trữ tệp. UC-ADM-04. Bảng: media.
import { Module } from '@nestjs/common';
import { AdminMediaController } from './admin-media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [AdminMediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
