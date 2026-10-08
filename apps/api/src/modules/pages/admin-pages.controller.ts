// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Trang tĩnh
// Controller – UC-ADM-07
// Bảng: pages
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – pages')
@Roles('admin')
@Controller('admin/pages')
export class AdminPagesController {}
