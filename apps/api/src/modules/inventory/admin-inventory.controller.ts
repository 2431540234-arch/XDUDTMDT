// UC-ADM-12 – Kho: /admin/inventory (chỉ role admin). Bảng: product_variants, inventory_movements, stock_receipts, stock_receipt_items
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
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

  @Get('movements')
  @ApiOperation({ summary: 'Lịch sử biến động tồn kho (variantId, type, from, to = YYYY-MM-DD, phân trang)' })
  async movements(@Query() q: RawQuery) {
    const r = await this.inventory.movements(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post('movements')
  @ApiOperation({
    summary:
      'Nhập/điều chỉnh/ghi nhận hàng trả: { variantId, type: import|adjustment|return, quantityChange, reason?, referenceCode? }',
  })
  record(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.inventory.record(adminId, body);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Danh sách phiếu nhập/xuất kho (mới nhất trước)' })
  receipts() {
    return this.inventory.receipts();
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Chi tiết phiếu kho kèm các dòng' })
  receipt(@Param('id', ParseIntPipe) id: number) {
    return this.inventory.receipt(id);
  }

  @Post('receipts')
  @ApiOperation({
    summary:
      'Tạo phiếu { type: in|out, supplierName?, orderCode?, status?: draft|completed, items:[{variantId, quantity, costPrice}] }. completed ⇒ ghi tồn ngay; draft ⇒ chưa đổi tồn',
  })
  createReceipt(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.inventory.createReceipt(adminId, body);
  }

  @Post('receipts/:id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận phiếu nháp: ghi movement + đổi tồn (phiếu nhập cập nhật giá vốn)' })
  confirm(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.inventory.confirmReceipt(adminId, id);
  }

  @Post('receipts/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hủy phiếu nháp (không đổi tồn)' })
  cancel(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.inventory.cancelReceipt(adminId, id);
  }
}
