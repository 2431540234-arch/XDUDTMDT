// M01 – Hệ thống và cấu hình. Cài đặt hệ thống (whitelist key công khai)
// Controller – UC-ADM-03
// Bảng: settings
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – settings')
@Roles('admin')
@Controller('admin/settings')
export class AdminSettingsController {}
