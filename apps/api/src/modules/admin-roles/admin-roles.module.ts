// M04 – Người dùng và phân quyền (admin). Vai trò và phân quyền
// Module – UC-ADM-02
// Bảng: roles, permissions, role_permissions, user_roles
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { AdminRolesController } from './admin-roles.controller';
import { AdminRolesService } from './admin-roles.service';

@Module({
  controllers: [AdminRolesController],
  providers: [AdminRolesService],
  exports: [AdminRolesService],
})
export class AdminRolesModule {}
