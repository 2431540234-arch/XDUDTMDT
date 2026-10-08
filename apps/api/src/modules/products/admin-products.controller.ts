// M07 – Sản phẩm, biến thể, tồn kho. Duyệt, tìm kiếm, chi tiết, quản trị sản phẩm
// Controller – UC-ADM-09
// Bảng: products, product_variants, product_images
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – products')
@Roles('admin')
@Controller('admin/products')
export class AdminProductsController {}
