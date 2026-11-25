// UC-ADM-12 – Kho: /admin/inventory (chỉ role admin). Bảng: product_variants
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { InventoryService } from './inventory.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – inventory')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Tồn kho theo biến thể (q, state=in_stock|low|out, categoryId, sort, phân trang)',
  })
  async rows(@Query() q: RawQuery) {
    const r = await this.inventory.rows(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Tổng tồn, giá trị tồn, số biến thể sắp hết / hết hàng' })
  summary() {
    return this.inventory.summary();
  }
}
