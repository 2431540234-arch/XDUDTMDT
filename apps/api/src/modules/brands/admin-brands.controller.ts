// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Thương hiệu
// Controller – UC-ADM-06
// Bảng: brands
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – brands')
@Roles('admin')
@Controller('admin/brands')
export class AdminBrandsController {}
