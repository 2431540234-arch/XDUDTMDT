// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Thuộc tính và giá trị thuộc tính
// Controller – UC-ADM-08
// Bảng: attributes, attribute_values
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – attributes')
@Roles('admin')
@Controller('admin/attributes')
export class AdminAttributesController {}
