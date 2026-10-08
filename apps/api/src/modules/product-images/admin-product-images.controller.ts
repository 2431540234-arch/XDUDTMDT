// M07 – Sản phẩm, biến thể, tồn kho. Ảnh sản phẩm
// Controller – UC-ADM-11
// Bảng: product_images
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – product-images')
@Roles('admin')
@Controller('admin/product-images')
export class AdminProductImagesController {}
