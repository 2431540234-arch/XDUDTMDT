// M12 – Mô hình 3D và AR
// Controller – UC-ADM-13, 14
// Bảng: product_3d_models, model_files, model_material_variants
// TRẠNG THÁI: mới có presign/confirm tệp mô hình; các endpoint còn lại chưa cài đặt.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminModelCatalogService } from './admin-model-catalog.service';
import { MODEL_MAX_BYTES } from './model-file-validator';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ConfirmModelFileDto, PresignModelFileDto } from './dto/model-file.dto';
import { ProductModelsService } from './product-models.service';

@ApiTags('Admin – models')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/models')
export class AdminModelsController {
  constructor(
    private readonly models: ProductModelsService,
    private readonly catalog: AdminModelCatalogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tệp mô hình 3D (productId, format, q, sort, phân trang)' })
  async list(@Query() q: RawQuery) {
    const r = await this.catalog.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post()
  @ApiOperation({
    summary:
      'Tải lên (JSON): { productId, fileName, sizeMB, format, allowAr, scale, unit?, fileData? (data-URL) }',
  })
  upload(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.catalog.uploadJson(adminId, body);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Tải lên tệp thật (multipart): file + productId, variantId?, allowAr?, scale?, unit?, placement?',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MODEL_MAX_BYTES + 1024 * 1024 },
    }),
  )
  uploadFile(
    @CurrentUser('id') adminId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string>,
  ) {
    return this.catalog.upload(adminId, {
      ...body,
      productId: body.productId,
      fileName: file?.originalname ?? '',
      format: body.format,
      bytes: file?.buffer,
      mimeType: file?.mimetype,
    });
  }

  @Delete(':id')
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.remove(adminId, id);
  }

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
