// M06 – Danh mục, thương hiệu, thuộc tính, trang tĩnh. Trang tĩnh
// Module – UC-CAT-05; UC-ADM-07
// Bảng: pages
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { AdminPagesController } from './admin-pages.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { PagesService } from './pages.service';

@Module({
  controllers: [PagesController, ContentController, AdminPagesController, AdminContentController],
  providers: [PagesService, ContentService, AdminContentService],
  exports: [PagesService, ContentService, AdminContentService],
})
export class PagesModule {}
