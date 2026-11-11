// M07 – Sản phẩm, biến thể, tồn kho. Ảnh sản phẩm
// Controller – UC-ADM-11
// Bảng: product_images
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – product-images')
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/product-images')
export class AdminProductImagesController {}
