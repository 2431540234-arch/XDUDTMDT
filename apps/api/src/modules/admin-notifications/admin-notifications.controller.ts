// UC-ADM-26 – Gửi thông báo cho người dùng: POST /admin/notifications (quyền manage_content). (GET /admin/notifications là chuông thông báo của admin, ở AdminMiscController.)
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AdminNotificationsService } from './admin-notifications.service';

@ApiTags('Admin – notifications')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Gửi thông báo: { title, content, type?: system|promo, link?, userIds?: number[] | all?: true } ⇒ 201 { sent }',
  })
  send(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.notifications.send(adminId, body);
  }
}
