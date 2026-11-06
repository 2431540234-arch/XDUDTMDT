// UC-ADM – Quản trị đổi trả: /admin/returns (chỉ role admin). Bảng: return_requests
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminReturnsService } from './admin-returns.service';

@ApiTags('Admin – returns')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(private readonly returns: AdminReturnsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách (status, type=refund|exchange, q, phân trang)' })
  async list(@Query() q: RawQuery) {
    const r = await this.returns.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Chuyển trạng thái: { status, adminNote? } (sai thứ tự ⇒ 409; từ chối bắt buộc có adminNote)',
  })
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.returns.update(adminId, id, body);
  }
}
