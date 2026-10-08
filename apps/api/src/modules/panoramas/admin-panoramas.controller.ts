// M13 – Không gian mẫu 360°. Ảnh panorama 360°
// Controller – UC-ADM-15
// Bảng: space_panoramas
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – panoramas')
@Roles('admin')
@Controller('admin/panoramas')
export class AdminPanoramasController {}
