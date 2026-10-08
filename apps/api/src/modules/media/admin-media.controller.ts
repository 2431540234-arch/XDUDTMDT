// M05 – Media và lưu trữ tệp
// Controller – UC-ADM-04
// Bảng: media
// TRẠNG THÁI: mới có luồng tải bằng presigned URL (presign, confirm); list/sửa/xóa chưa cài đặt.
import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ConfirmUploadDto, PresignUploadDto } from './dto/media-upload.dto';
import { MediaService, type UploadedImage } from './media.service';

@ApiTags('Admin – media')
@Roles('admin')
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  /** Ảnh thường (<= 5 MB): multipart, trường "file". API ghi lên MinIO rồi tạo media. */
  @Post()
  @HttpCode(201)
  // Giới hạn cứng 20 MB ở multer chỉ để chặn lạm dụng bộ nhớ; hạn mức 5 MB do MediaService kiểm tra (trả 413 chuẩn)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  uploadImage(
    @UploadedFile() file: UploadedImage | undefined,
    @Body('altText') altText: string | undefined,
    @CurrentUser('id') adminId: number,
  ) {
    return this.media.uploadImage(file, adminId, altText);
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
}
