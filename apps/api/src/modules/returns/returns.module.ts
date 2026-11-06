// M16 – Đổi trả & hoàn tiền (UC-ORD đổi trả, UC-ADM đổi trả). Bảng: return_requests, return_request_items, return_request_images
import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
