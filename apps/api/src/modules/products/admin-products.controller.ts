// UC-ADM-09 – Quản trị sản phẩm: /admin/products (chỉ role admin), gồm tab Ảnh 360°: GET|PUT /admin/products/:id/360
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminProductsService } from './admin-products.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – products')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách sản phẩm (q, category, status=selling|out|draft|published|archived, sort, phân trang)',
  })
  async list(@Query() q: RawQuery) {
    const r = await this.products.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm sản phẩm (thông tin, ảnh, biến thể, thông số, SEO)' })
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.products.create(adminId, body);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.products.get(id);
  }

  @Get(':id/360')
  get360(@Param('id', ParseIntPipe) id: number) {
    return this.products.get360(id);
  }

  @Put(':id/360')
  @ApiOperation({
    summary: 'Lưu ảnh 360°: { enabled, autoRotate, colors:[{name,hex,frames[]}] } (mỗi frame ≤ 2MB)',
  })
  save360(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.products.save360(adminId, id, body);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.products.update(adminId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa: sản phẩm đã có trong đơn hàng được chuyển sang ngừng bán thay vì xóa' })
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.products.remove(adminId, id);
  }
}
