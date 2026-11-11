// Khu vực admin: GET /admin/notifications (chuông), GET /admin/search?q= (tìm nhanh)
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminMiscService } from './admin-misc.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – misc')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('view_orders')
@Controller('admin')
export class AdminMiscController {
  constructor(private readonly misc: AdminMiscService) {}

  @Get('notifications')
  notifications() {
    return this.misc.notifications();
  }

  @RequirePermission('manage_products', 'view_orders', 'manage_users')
  @Get('search')
  search(@Query() q: RawQuery) {
    return this.misc.search(q);
  }
}
