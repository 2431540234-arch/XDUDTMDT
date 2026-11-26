// M12 – Mô hình 3D và AR
// Controller – UC-ADM-13, 14
// Bảng: product_3d_models, model_files, model_material_variants
// Tải lên (multipart/JSON) ⇒ 202, xử lý nền (model-processing); xử lý lại; mô hình chính; presign/confirm dành cho MinIO.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminModelCatalogService } from './admin-model-catalog.service';
import { MODEL_MAX_BYTES } from './model-file-validator';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ConfirmModelFileDto, PresignModelFileDto } from './dto/model-file.dto';
import { ModelMaterialsService } from './model-materials.service';
import { ModelReviewService } from './model-review.service';
import { ProductModelsService } from './product-models.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – models')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/models')
export class AdminModelsController {
  constructor(
    private readonly models: ProductModelsService,
    private readonly catalog: AdminModelCatalogService,
    private readonly materials: ModelMaterialsService,
    private readonly review: ModelReviewService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tệp mô hình 3D (productId, format, q, sort, phân trang)' })
  async list(@Query() q: RawQuery) {
    const r = await this.catalog.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Tải lên (JSON): { productId, fileName, format, fileData (data-URL), placement?, removeFloor? } ⇒ 202 { modelId, jobId, status: processing }',
  })
  upload(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.catalog.uploadJson(adminId, body);
  }

  @Post('upload')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Tải lên tệp thật (multipart): file + productId, variantId?, placement?, removeFloor? ⇒ 202, chuẩn hóa nền rồi chờ duyệt',
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

  @Delete('model/:modelId')
  @ApiOperation({ summary: 'Xóa cả mô hình (kể cả mô hình chưa có tệp: đang xử lý hoặc lỗi)' })
  removeModel(@CurrentUser('id') adminId: number, @Param('modelId', ParseIntPipe) modelId: number) {
    return this.catalog.removeModel(adminId, modelId);
  }

  @Delete(':id')
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.remove(adminId, id);
  }

  /**
   * Driver MinIO/S3: chọn/tạo mô hình đích rồi cấp URL PUT thẳng lên bucket private. Body như upload (productId,
   * placement, removeFloor…) + { fileName, size, format }. Sau khi PUT xong gọi POST :id/files/confirm.
   */
  @Post('presign')
  @HttpCode(200)
  presignUpload(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.catalog.presignUpload(adminId, this.catalog.presignInput(body));
  }

  @Post(':id/reprocess')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Xử lý lại mô hình failed từ tệp gốc đã lưu (failed → processing); :id là id MÔ HÌNH',
  })
  reprocess(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.reprocess(adminId, id);
  }

  @Patch(':id/primary')
  @ApiOperation({ summary: 'Đặt làm mô hình chính của sản phẩm (chỉ khi ready); :id là id MÔ HÌNH' })
  setPrimary(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.setPrimary(adminId, id);
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

  // ---- duyệt mô hình (:id là id MÔ HÌNH) ----
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết mô hình cho màn duyệt: quy trình, thông số chuẩn hóa, các phiên bản' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.review.detail(id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Tệp GLB của bản CHỜ DUYỆT (?variant=cleaned|original&lod=high|medium|low)' })
  async preview(
    @Param('id', ParseIntPipe) id: number,
    @Query('variant') variant: string | undefined,
    @Query('lod') lod: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body = await this.review.preview(id, variant, lod);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(body, { type: 'model/gltf-binary', length: body.length });
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Duyệt { variant?, posterDataUrl? }: thay mô hình đang hiện' })
  approve(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.review.approve(adminId, id, body);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bỏ bản chờ duyệt / lỗi: xóa tệp tạm và bản ghi' })
  reject(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.review.reject(adminId, id);
  }

  @Post(':id/renormalize')
  @HttpCode(202)
  @ApiOperation({ summary: 'Chuẩn hóa lại { yawDeg?, removeFloor? } từ tệp gốc (không gọi AI)' })
  renormalize(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.review.renormalize(adminId, id, body);
  }

  // ---- UC-ADM-14: vật liệu theo biến thể (:id là id MÔ HÌNH) ----
  @Get(':id/materials')
  @ApiOperation({ summary: 'Tên các vật liệu có trong tệp GLB của mô hình (để chọn materialName)' })
  materialNames(@Param('id', ParseIntPipe) id: number) {
    return this.materials.materialNames(id);
  }

  @Get(':id/material-variants')
  @ApiOperation({ summary: 'Cấu hình vật liệu theo biến thể của mô hình' })
  listMaterialVariants(@Param('id', ParseIntPipe) id: number) {
    return this.materials.list(id);
  }

  @Put(':id/material-variants/:variantId')
  @ApiOperation({
    summary: 'Đặt (tạo hoặc thay thế) cấu hình vật liệu { materialName, config } cho một biến thể',
  })
  setMaterialVariant(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: unknown,
  ) {
    return this.materials.set(adminId, id, variantId, body);
  }

  @Delete(':id/material-variants/:variantId')
  @ApiOperation({ summary: 'Xóa cấu hình vật liệu của một biến thể' })
  removeMaterialVariant(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
  ) {
    return this.materials.remove(adminId, id, variantId);
  }
}
