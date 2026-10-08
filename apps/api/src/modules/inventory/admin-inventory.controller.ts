// M07 – Sản phẩm, biến thể, tồn kho. Nhập kho và điều chỉnh tồn kho
// Controller – UC-ADM-12
// Bảng: inventory_movements, product_variants
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – inventory')
@Roles('admin')
@Controller('admin/inventory')
export class AdminInventoryController {}
