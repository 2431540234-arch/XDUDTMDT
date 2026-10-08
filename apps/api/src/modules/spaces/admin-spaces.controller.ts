// M13 – Không gian mẫu 360°. Không gian mẫu 360°
// Controller – UC-ADM-15, 17
// Bảng: spaces, space_bookmarks, space_views, space_product_placements
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – spaces')
@Roles('admin')
@Controller('admin/spaces')
export class AdminSpacesController {}
