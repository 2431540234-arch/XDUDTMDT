// M04 – Người dùng và phân quyền (admin). Vai trò và phân quyền
// Controller – UC-ADM-02
// Bảng: roles, permissions, role_permissions, user_roles
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – roles')
@Roles('admin')
@RequirePermission('manage_users')
@Controller('admin/roles')
export class AdminRolesController {}
