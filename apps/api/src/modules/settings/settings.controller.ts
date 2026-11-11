// M01 – Hệ thống và cấu hình. Cài đặt hệ thống (whitelist key công khai)
// Controller – UC-ADM-03 (đọc công khai)
// Bảng: settings
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {}
