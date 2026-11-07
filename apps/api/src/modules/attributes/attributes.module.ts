// M06 – Thuộc tính và giá trị thuộc tính. Module – UC-ADM-08. Bảng: attributes, attribute_values
import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AdminAttributesController } from './admin-attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  imports: [ProductsModule],
  controllers: [AdminAttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
