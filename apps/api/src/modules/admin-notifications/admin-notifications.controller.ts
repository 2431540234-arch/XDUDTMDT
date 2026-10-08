// M14 – Thông báo và thống kê quản trị. Gửi thông báo cho người dùng (dùng NotificationsService của M03)
// Controller – UC-ADM-26
// Bảng: notifications
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – notifications')
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationsController {}
