// M14 – Thông báo và thống kê quản trị. Gửi thông báo cho người dùng (dùng NotificationsService của M03)
// Module – UC-ADM-26
// Bảng: notifications
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminNotificationsController } from './admin-notifications.controller';

@Module({
  controllers: [AdminNotificationsController],
})
export class AdminNotificationsModule {}
