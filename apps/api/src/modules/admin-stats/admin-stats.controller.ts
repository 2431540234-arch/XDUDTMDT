// M14 – Thông báo và thống kê quản trị. Thống kê tổng quan, AR và phễu không gian mẫu
// Controller – UC-ADM-28, 29
// Bảng: orders, ar_sessions, space_views (tổng hợp)
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – stats')
@Roles('admin')
@Controller('admin/stats')
export class AdminStatsController {}
