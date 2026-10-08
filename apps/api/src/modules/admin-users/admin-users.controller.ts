// M04 – Người dùng và phân quyền (admin). Quản lý người dùng
// Controller – UC-ADM-01
// Bảng: users, user_roles
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – users')
@Roles('admin')
@Controller('admin/users')
export class AdminUsersController {}
