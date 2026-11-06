// M03 – Tài khoản cá nhân. Thông báo của người dùng
// Module – UC-ACC-05
// Bảng: notifications
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
