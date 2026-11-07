// UC-ADM-06 – Quản lý thương hiệu: /admin/brands (chỉ role admin). Bảng: brands
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { BrandsService } from './brands.service';

@ApiTags('Admin – brands')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thương hiệu kèm số sản phẩm (q)' })
  list(@Query() q: RawQuery) {
    return this.brands.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.brands.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm { name, slug?, logoUrl?, isActive? } – slug trùng ⇒ 409' })
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.brands.create(adminId, body);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.brands.update(adminId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa; sản phẩm đang dùng chuyển brandId = NULL. Trả { id, productsDetached }' })
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.brands.remove(adminId, id);
  }
}
