// UC-ADM-02 – Quản lý vai trò và phân quyền. Chỉ có 2 vai trò (admin, user) và 6 quyền; KHÔNG tạo vai trò mới.
// Bảng: roles (R), permissions (R), role_permissions (R), user_roles (C, D, R).
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /** GET /admin/roles: các vai trò kèm quyền (và số người dùng) */
  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: {
        rolePermissions: { include: { permission: true }, orderBy: { permissionId: 'asc' } },
        _count: { select: { userRoles: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      userCount: r._count.userRoles,
      permissions: r.rolePermissions.map((rp) => ({
        code: rp.permission.code,
        name: rp.permission.name,
        description: rp.permission.description,
      })),
    }));
  }

  private async view(userId: number) {
    const roles = await this.prisma.userRole.findMany({ where: { userId }, include: { role: true } });
    return { id: userId, roles: roles.map((r) => r.role.code) };
  }

  private async target(userId: number) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!u) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Người dùng không tồn tại.');
    return u;
  }

  /** PUT /admin/users/:id/roles/admin – gán vai trò admin (idempotent). Hiệu lực ở lần đăng nhập/làm mới token kế tiếp. */
  async grantAdmin(actorId: number, userId: number) {
    const u = await this.target(userId);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: 'admin' } });
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userRole.findUnique({
        where: { userId_roleId: { userId, roleId: role.id } },
      });
      if (existing) return;
      await tx.userRole.create({ data: { userId, roleId: role.id } });
      await this.activity.log(
        {
          actorId,
          action: 'user.grant_admin',
          targetType: 'user',
          targetId: userId,
          changes: { email: u.email },
        },
        tx,
      );
    });
    return this.view(userId);
  }

  /**
   * DELETE /admin/users/:id/roles/admin – gỡ vai trò admin. 409 nếu tự gỡ quyền của chính mình hoặc gỡ admin CUỐI CÙNG
   * (đếm trong transaction, khóa các dòng user_roles của vai trò admin để hai yêu cầu đồng thời không cùng gỡ).
   */
  async revokeAdmin(actorId: number, userId: number) {
    if (actorId === userId)
      throw new AppException(ErrorCode.INVALID_STATE, 'Bạn không thể tự gỡ quyền quản trị của chính mình.');
    const u = await this.target(userId);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: 'admin' } });
    await this.prisma.$transaction(async (tx) => {
      const admins = await tx.$queryRaw<Array<{ user_id: number }>>`
        SELECT ur.user_id FROM user_roles ur JOIN users u ON u.id = ur.user_id
        WHERE ur.role_id = ${role.id} AND u.deleted_at IS NULL FOR UPDATE OF ur`;
      if (!admins.some((a) => a.user_id === userId))
        throw new AppException(ErrorCode.INVALID_STATE, 'Người dùng không có vai trò quản trị.');
      if (admins.length <= 1)
        throw new AppException(ErrorCode.INVALID_STATE, 'Không thể gỡ quản trị viên cuối cùng của hệ thống.');
      await tx.userRole.delete({ where: { userId_roleId: { userId, roleId: role.id } } });
      await this.activity.log(
        {
          actorId,
          action: 'user.revoke_admin',
          targetType: 'user',
          targetId: userId,
          changes: { email: u.email },
        },
        tx,
      );
    });
    return this.view(userId);
  }
}
