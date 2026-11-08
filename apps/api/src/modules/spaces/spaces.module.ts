// M13 – Không gian mẫu 360°. Không gian mẫu 360°
// Module – UC-SPACE-01..06; UC-ADM-15, 17
// Bảng: spaces, space_bookmarks, space_views, space_product_placements
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { SpacesController } from './spaces.controller';
import { AdminSpacesController } from './admin-spaces.controller';
import { CartModule } from '../cart/cart.module';
import { PanoramasModule } from '../panoramas/panoramas.module';
import { ProductsModule } from '../products/products.module';
import { AdminSpacesService } from './admin-spaces.service';
import { SpacesService } from './spaces.service';

@Module({
  imports: [CartModule, ProductsModule, PanoramasModule],
  controllers: [SpacesController, AdminSpacesController],
  providers: [SpacesService, AdminSpacesService],
  exports: [SpacesService, AdminSpacesService],
})
export class SpacesModule {}
