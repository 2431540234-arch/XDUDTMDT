// M07 – Sản phẩm công khai: /products, /products/search, /products/facets, /products/:slug (+model, 360, related)
// Đánh giá và hỏi đáp theo sản phẩm nằm ở module reviews (cùng tiền tố /products/:slug/...).
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { Product360Service } from './product-360.service';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly p360: Product360Service,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Danh sách sản phẩm (lọc, sắp xếp, phân trang)' })
  async list(@Query() q: RawQuery, @CurrentUser('id') userId?: number) {
    const r = await this.products.list(q, userId ?? null, 'createdAt:desc');
    return paginated(r.data, r.page, r.pageSize, r.total);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm không dấu (mặc định sắp xếp theo độ liên quan)' })
  async search(@Query() q: RawQuery, @CurrentUser('id') userId?: number) {
    const r = await this.products.list(q, userId ?? null, 'relevance');
    return paginated(r.data, r.page, r.pageSize, r.total);
  }

  @Public()
  @Get('facets')
  @ApiOperation({ summary: 'Số lượng theo danh mục, màu, chất liệu, phong cách' })
  facets(@Query() q: RawQuery) {
    return this.products.facets(q);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết sản phẩm (biến thể, ảnh, thông số, mô hình 3D)' })
  detail(@Param('slug') slug: string, @CurrentUser('id') userId?: number) {
    return this.products.detail(slug, userId ?? null);
  }

  @Public()
  @Get(':slug/model')
  model(@Param('slug') slug: string) {
    return this.products.model(slug);
  }

  @Public()
  @Get(':slug/360')
  @ApiOperation({ summary: 'Dữ liệu xem 360° (ảnh theo màu, biến thể, chính sách)' })
  view360(@Param('slug') slug: string, @CurrentUser('id') userId?: number) {
    return this.p360.view(slug, userId ?? null);
  }

  @Public()
  @Get(':slug/related')
  related(@Param('slug') slug: string, @CurrentUser('id') userId?: number) {
    return this.products.related(slug, userId ?? null);
  }
}
