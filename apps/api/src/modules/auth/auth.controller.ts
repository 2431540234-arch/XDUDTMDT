// M02 – Xác thực và phiên. Đăng ký, đăng nhập, refresh, đăng xuất, quên/đặt lại mật khẩu, xác thực email
// Controller – UC-AUTH-01..07
// Bảng: users, password_resets, user_sessions
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {}
