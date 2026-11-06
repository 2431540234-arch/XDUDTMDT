// UC-ADM – Quản trị hỏi đáp: /admin/questions (chỉ role admin). Bảng: product_questions
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminQuestionsService } from './admin-questions.service';

@ApiTags('Admin – questions')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(private readonly questions: AdminQuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách (status=unanswered|answered|hidden, q, phân trang)' })
  async list(@Query() q: RawQuery) {
    const r = await this.questions.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Trả lời/sửa { answer, isPublic } · ẩn { status: hidden } · hiện lại { status: visible }',
  })
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.questions.update(adminId, id, body);
  }
}
