// M05 – Media và lưu trữ tệp. Tải lên và quản lý tệp (StorageService)
// Controller – UC-ADM-04
// Bảng: media
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – media')
@Roles('admin')
@Controller('admin/media')
export class AdminMediaController {}
