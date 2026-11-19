// UC-ADM – Quản trị nội dung: /admin/faq (chỉ role admin)
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AdminContentService } from './admin-content.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – content')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin')
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  // ---- FAQ (lưu trong settings)
  @Get('faq')
  faq() {
    return this.content.faq();
  }

  @Put('faq')
  @ApiOperation({ summary: 'Thay toàn bộ FAQ: { topics: [{ key?, label, items: [{ question, answer }] }] }' })
  saveFaq(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.content.saveFaq(adminId, body);
  }
}
