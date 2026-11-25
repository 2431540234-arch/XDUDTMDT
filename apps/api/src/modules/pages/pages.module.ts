// Nội dung công khai và quản trị: FAQ, cài đặt cửa hàng công khai (bảng: settings).
import { Module } from '@nestjs/common';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  controllers: [ContentController, AdminContentController],
  providers: [ContentService, AdminContentService],
  exports: [ContentService, AdminContentService],
})
export class PagesModule {}
