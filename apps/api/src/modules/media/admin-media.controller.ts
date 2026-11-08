// M05 – Media và lưu trữ tệp
// Controller – UC-ADM-04
// Bảng: media
// TRẠNG THÁI: mới có luồng tải bằng presigned URL (presign, confirm); list/sửa/xóa chưa cài đặt.
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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ConfirmUploadDto, PresignUploadDto } from './dto/media-upload.dto';
import { MediaService, type UploadedImage } from './media.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – media')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_products', 'manage_content')
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  /** Một tệp ảnh: multipart, trường "file" (+ kind = image | frame | panorama). Ảnh 5 MB, frame 360° 2 MB, panorama 20 MB. */
  @Post()
  @HttpCode(201)
  // Giới hạn cứng 25 MB ở multer chỉ để chặn lạm dụng bộ nhớ; hạn mức 5 MB do MediaService kiểm tra (trả 413 chuẩn)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  uploadImage(
    @UploadedFile() file: UploadedImage | undefined,
    @Body('altText') altText: string | undefined,
    @Body('kind') kind: string | undefined,
    @CurrentUser('id') adminId: number,
  ) {
    const k = kind === 'frame' || kind === 'panorama' ? kind : 'image';
    return this.media.uploadImage(file, adminId, altText, k);
  }

  /** Cấp URL để trình duyệt PUT panorama (<= 20 MB) thẳng lên MinIO. */
  @Post('presign')
  @HttpCode(200)
  presign(@Body() dto: PresignUploadDto) {
    return this.media.presign(dto);
  }

  /** Xác nhận đã PUT xong: tạo bản ghi media và đẩy job xử lý ảnh. */
  @Post('confirm')
  @HttpCode(201)
  confirm(@Body() dto: ConfirmUploadDto, @CurrentUser('id') adminId: number) {
    return this.media.confirm(dto, adminId);
  }

  @Get()
  @ApiOperation({ summary: 'Thư viện media (phân trang; q, type=image|other, usage=unused)' })
  async list(@Query() q: RawQuery) {
    const r = await this.media.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa mô tả ảnh { altText } (≤ 255 ký tự)' })
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.media.update(adminId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa tệp; đang được sử dụng (khóa ngoại RESTRICT) ⇒ 409' })
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.media.remove(adminId, id);
  }
}
