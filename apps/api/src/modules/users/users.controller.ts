// M01 – Hồ sơ cá nhân: /users/me. Controller – UC-USR (xem/sửa hồ sơ, đổi mật khẩu). Bảng: users
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type RequestUser } from '../../common/decorators/auth.decorators';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Hồ sơ của tôi (kèm số đơn, tổng chi tiêu, nhóm khách hàng)' })
  me(@CurrentUser('id') id: number) {
    return this.users.view(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật hồ sơ: fullName, phone, gender, birthday, avatarUrl' })
  update(@CurrentUser('id') id: number, @Body() body: unknown) {
    return this.users.updateMe(id, body);
  }

  @Get('me/sessions')
  @ApiOperation({
    summary: 'Phiên đăng nhập còn hiệu lực của tôi (thiết bị, IP, thời gian; current = thiết bị này)',
  })
  sessions(@CurrentUser() user: RequestUser) {
    return this.users.sessions(user.id, user.sessionId);
  }

  @Delete('me/sessions/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Đăng xuất một thiết bị: thu hồi phiên (chỉ phiên của chính mình)' })
  revokeSession(@CurrentUser('id') id: number, @Param('id', ParseIntPipe) sessionId: number) {
    return this.users.revokeSession(id, sessionId);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Xóa tài khoản (xóa mềm): { password }; còn đơn pending…shipping ⇒ 409; thu hồi mọi phiên',
  })
  deleteMe(@CurrentUser('id') id: number, @Body() body: unknown) {
    return this.users.deleteMe(id, body);
  }

  @Post('me/change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi mật khẩu: { currentPassword, newPassword, logoutOthers? }' })
  changePassword(
    @CurrentUser('id') id: number,
    @CurrentUser('sessionId') sessionId: number | undefined,
    @Body() body: unknown,
  ) {
    return this.users.changePassword(id, body, sessionId);
  }
}
