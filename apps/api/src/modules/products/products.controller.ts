// M07 – Sản phẩm, biến thể, tồn kho. Duyệt, tìm kiếm, chi tiết, quản trị sản phẩm
// Controller – UC-CAT-01, 02, 03, 04, 06
// Bảng: products, product_variants, product_images
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('products')
@Controller('products')
export class ProductsController {}
