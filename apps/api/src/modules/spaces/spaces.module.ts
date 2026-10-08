// M13 – Không gian mẫu 360°. Không gian mẫu 360°
// Module – UC-SPACE-01..06; UC-ADM-15, 17
// Bảng: spaces, space_bookmarks, space_views, space_product_placements
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { SpacesController } from './spaces.controller';
import { AdminSpacesController } from './admin-spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  controllers: [SpacesController, AdminSpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
