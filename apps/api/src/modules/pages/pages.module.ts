// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Trang tĩnh
// Module – UC-CAT-05; UC-ADM-07
// Bảng: pages
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { AdminPagesController } from './admin-pages.controller';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { PagesService } from './pages.service';

@Module({
  controllers: [PagesController, ContentController, AdminPagesController],
  providers: [PagesService, ContentService],
  exports: [PagesService, ContentService],
})
export class PagesModule {}
