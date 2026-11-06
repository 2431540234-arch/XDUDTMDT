// M01 – Hồ sơ cá nhân: /users/me. Controller – UC-USR (xem/sửa hồ sơ, đổi mật khẩu). Bảng: users
import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
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

  @Post('me/change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi mật khẩu: { currentPassword, newPassword, logoutOthers? }' })
  changePassword(@CurrentUser('id') id: number, @Body() body: unknown) {
    return this.users.changePassword(id, body);
  }
}
