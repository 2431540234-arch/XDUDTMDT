// UC-ADM-27 – Xem nhật ký hoạt động của quản trị viên: /admin/activity-logs (quyền manage_settings). CHỈ ĐỌC: không có POST/PATCH/DELETE.
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { ActivityLogsService } from './activity-logs.service';

@ApiTags('Admin – activity-logs')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_settings')
@Controller('admin/activity-logs')
export class AdminActivityLogsController {
  constructor(private readonly logs: ActivityLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Nhật ký hoạt động (actorId, action, targetType, from, to, page, pageSize); mới nhất trước',
  })
  async list(@Query() q: RawQuery) {
    const r = await this.logs.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Get('options')
  @ApiOperation({ summary: 'Giá trị cho bộ lọc: quản trị viên, hành động, loại đối tượng' })
  options() {
    return this.logs.options();
  }
}
