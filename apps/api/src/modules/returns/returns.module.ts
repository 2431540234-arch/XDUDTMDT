// M16 – Đổi trả & hoàn tiền (UC-ORD đổi trả, UC-ADM đổi trả). Bảng: return_requests, return_request_items, return_request_images
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminReturnsController } from './admin-returns.controller';
import { AdminReturnsService } from './admin-returns.service';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [OrdersModule],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService, AdminReturnsService],
  exports: [ReturnsService, AdminReturnsService],
})
export class ReturnsModule {}
