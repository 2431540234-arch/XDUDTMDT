// UC-ADM-02 – Quản lý vai trò và phân quyền: GET /admin/roles (2 vai trò kèm quyền, chỉ đọc). Gán/gỡ admin nằm ở
// PUT|DELETE /admin/users/:id/roles/admin (AdminUsersController).
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AdminRolesService } from './admin-roles.service';

@ApiTags('Admin – roles')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_users')
@Controller('admin/roles')
export class AdminRolesController {
  constructor(private readonly roles: AdminRolesService) {}

  @Get()
  @ApiOperation({ summary: 'Hai vai trò (admin, user) kèm quyền và số người dùng' })
  list() {
    return this.roles.list();
  }
}
