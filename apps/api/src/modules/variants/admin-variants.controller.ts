// M07 – Sản phẩm, biến thể, tồn kho. Biến thể sản phẩm
// Controller – UC-ADM-10
// Bảng: product_variants, variant_attribute_values
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – variants')
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/variants')
export class AdminVariantsController {}
