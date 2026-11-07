// M06 – Thương hiệu. Module – UC-ADM-06. Bảng: brands
import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AdminBrandsController } from './admin-brands.controller';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [ProductsModule],
  controllers: [BrandsController, AdminBrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
