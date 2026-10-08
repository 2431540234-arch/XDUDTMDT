// M01 – Hệ thống và cấu hình
// Controller – UC-ADM-27
// Bảng: activity_logs
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – activity-logs')
@Roles('admin')
@Controller('admin/activity-logs')
export class AdminActivityLogsController {}
