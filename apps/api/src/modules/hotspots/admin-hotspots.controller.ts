// M13 – Không gian mẫu 360°. Điểm tương tác trên ảnh 360°
// Controller – UC-ADM-16
// Bảng: space_hotspots
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – hotspots')
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin/hotspots')
export class AdminHotspotsController {}
