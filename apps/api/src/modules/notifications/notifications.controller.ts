// M14 – Thông báo: /notifications (chỉ của chính khách)
import { Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser('id') uid: number, @Query() q: RawQuery) {
    const r = await this.notifications.list(uid, q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Get('unread-count')
  unread(@CurrentUser('id') uid: number) {
    return this.notifications.unreadCount(uid);
  }

  // read-all phải khai báo trước :id/read
  @Patch('read-all')
  readAll(@CurrentUser('id') uid: number) {
    return this.notifications.markAllRead(uid);
  }

  @Patch(':id/read')
  read(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(uid, id);
  }
}
