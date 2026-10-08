// M03 – Tài khoản cá nhân. Hồ sơ, đổi mật khẩu, phiên đăng nhập, xóa tài khoản
// Controller – UC-ACC-01, 02, 03, 07
// Bảng: users, user_sessions
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {}
