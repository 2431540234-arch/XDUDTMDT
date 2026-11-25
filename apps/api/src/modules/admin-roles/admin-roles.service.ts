// UC-ADM-02 – Quản lý vai trò và phân quyền. Chỉ có 2 vai trò (admin, user) và 6 quyền; KHÔNG tạo vai trò mới.
// Vai trò và quyền là hằng số (common/auth/role-permissions.ts); người dùng có đúng một vai trò: users.role.
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import {
  PERMISSION_DESCRIPTIONS,
  ROLE_CODES,
  ROLE_INFO,
  ROLE_PERMISSIONS,
} from '../../common/auth/role-permissions';
import { PERMISSION_NAMES } from '../../common/decorators/permissions.decorator';
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
    const counts = await this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
    return ROLE_CODES.map((code) => ({
      id: ROLE_INFO[code].id,
      code,
      name: ROLE_INFO[code].name,
      description: ROLE_INFO[code].description,
      userCount: counts.find((c) => c.role === code)?._count._all ?? 0,
      permissions: ROLE_PERMISSIONS[code].map((p) => ({
        code: p,
        name: PERMISSION_NAMES[p],
        description: PERMISSION_DESCRIPTIONS[p],
      })),
    }));
  }

  private async view(userId: number) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    return { id: userId, roles: [u.role] };
  }

  private async target(userId: number) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!u) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Người dùng không tồn tại.');
    return u;
  }

  /** PUT /admin/users/:id/roles/admin – đổi vai trò thành admin (idempotent). Hiệu lực ở request kế tiếp. */
  async grantAdmin(actorId: number, userId: number) {
    const u = await this.target(userId);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.user.updateMany({ where: { id: userId, role: 'user' }, data: { role: 'admin' } });
      if (r.count === 0) return;
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
   * DELETE /admin/users/:id/roles/admin – đổi vai trò admin thành user. 409 nếu tự gỡ quyền của chính mình hoặc gỡ admin CUỐI CÙNG
   * (đếm users.role = 'admin' trong transaction, khóa các dòng admin để hai yêu cầu đồng thời không cùng gỡ).
   */
  async revokeAdmin(actorId: number, userId: number) {
    if (actorId === userId)
      throw new AppException(ErrorCode.INVALID_STATE, 'Bạn không thể tự gỡ quyền quản trị của chính mình.');
    const u = await this.target(userId);
    await this.prisma.$transaction(async (tx) => {
      const admins = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL FOR UPDATE`;
      if (!admins.some((a) => a.id === userId))
        throw new AppException(ErrorCode.INVALID_STATE, 'Người dùng không có vai trò quản trị.');
      if (admins.length <= 1)
        throw new AppException(ErrorCode.INVALID_STATE, 'Không thể gỡ quản trị viên cuối cùng của hệ thống.');
      await tx.user.update({ where: { id: userId }, data: { role: 'user' } });
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
