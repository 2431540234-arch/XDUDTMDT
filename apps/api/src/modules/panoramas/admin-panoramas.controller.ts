// M13 – Không gian mẫu 360°. Ảnh panorama 360°
// Controller – UC-ADM-15
// Bảng: space_panoramas
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – panoramas')
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin/panoramas')
export class AdminPanoramasController {}
