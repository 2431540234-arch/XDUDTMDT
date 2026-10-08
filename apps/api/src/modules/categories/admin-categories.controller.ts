// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Danh mục sản phẩm
// Controller – UC-ADM-05
// Bảng: categories
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – categories')
@Roles('admin')
@Controller('admin/categories')
export class AdminCategoriesController {}
