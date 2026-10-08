// M12 – Mô hình 3D và AR. Mô hình 3D: tải lên, kiểm tra định dạng/dung lượng, lưu, status ready/failed (xử lý ĐỒNG BỘ, không hàng đợi)
// Controller – UC-ADM-13, 14
// Bảng: product_3d_models, model_files, model_material_variants
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – models')
@Roles('admin')
@Controller('admin/models')
export class AdminModelsController {}
