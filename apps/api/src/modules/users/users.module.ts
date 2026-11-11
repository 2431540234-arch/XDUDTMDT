// M03 – Tài khoản cá nhân. Hồ sơ, đổi mật khẩu, phiên đăng nhập, xóa tài khoản
// Module – UC-ACC-01, 02, 03, 07
// Bảng: users, user_sessions
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
