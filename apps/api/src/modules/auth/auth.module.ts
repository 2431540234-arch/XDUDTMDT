// M02 – Xác thực và phiên. Đăng ký, đăng nhập, refresh, đăng xuất, quên/đặt lại mật khẩu, xác thực email
// Module – UC-AUTH-01..07
// Bảng: users, password_resets, user_sessions
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
