// M12 – Mô hình 3D và AR
// Controller – UC-ADM-13, 14
// Bảng: product_3d_models, model_files, model_material_variants
// TRẠNG THÁI: mới có presign/confirm tệp mô hình; các endpoint còn lại chưa cài đặt.
import { Body, Controller, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ConfirmModelFileDto, PresignModelFileDto } from './dto/model-file.dto';
import { ProductModelsService } from './product-models.service';

@ApiTags('Admin – models')
@Roles('admin')
@Controller('admin/models')
export class AdminModelsController {
  constructor(private readonly models: ProductModelsService) {}

  /** Cấp URL để trình duyệt PUT tệp GLB/USDZ gốc thẳng lên MinIO (bucket private). */
  @Post(':id/files/presign')
  @HttpCode(200)
  presign(@Param('id', ParseIntPipe) id: number, @Body() dto: PresignModelFileDto) {
    return this.models.presignFile(id, dto);
  }

  /** Xác nhận đã PUT xong: đặt trạng thái processing và đẩy job xử lý. Trả 202. */
  @Post(':id/files/confirm')
  @HttpCode(202)
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmModelFileDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.models.confirmFile(id, dto, adminId);
  }
}
