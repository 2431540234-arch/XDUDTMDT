// Khu vực admin: GET /admin/notifications (chuông), GET /admin/search?q= (tìm nhanh)
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminMiscService } from './admin-misc.service';

@ApiTags('Admin – misc')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminMiscController {
  constructor(private readonly misc: AdminMiscService) {}

  @Get('notifications')
  notifications() {
    return this.misc.notifications();
  }

  @Get('search')
  search(@Query() q: RawQuery) {
    return this.misc.search(q);
  }
}
