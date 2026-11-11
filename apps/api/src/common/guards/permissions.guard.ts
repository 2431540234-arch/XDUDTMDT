// Guard toàn cục: kiểm tra quyền chi tiết (role_permissions) của route gắn @RequirePermission(...).
// Route không gắn thì bỏ qua (chỉ đi qua JwtAuthGuard/RolesGuard); test quét metadata để bảo đảm mọi route /admin/* đều có quyền.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@aurelia-living/shared-types';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY, PERMISSION_NAMES, type PermissionCode } from '../decorators/permissions.decorator';
import type { RequestUser } from '../decorators/auth.decorators';
import { AppException } from '../exceptions/app.exception';

/** Thời gian giữ quyền trong bộ nhớ tiến trình (không dùng Redis, cache Redis vẫn hoãn). Đổi quyền có hiệu lực sau tối đa chừng này. */
export const PERMISSION_CACHE_TTL_MS = 10_000;

@Injectable()
export class PermissionsService {
  private cache = new Map<string, { codes: Set<string>; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /** Tập mã quyền của các vai trò (gộp), đọc role_permissions; cache bộ nhớ ngắn hạn */
  async codesOf(roles: string[]): Promise<Set<string>> {
    const key = [...roles].sort().join(',');
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.codes;
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { code: { in: roles } } },
      select: { permission: { select: { code: true } } },
    });
    const codes = new Set(rows.map((r) => r.permission.code));
    this.cache.set(key, { codes, expires: Date.now() + PERMISSION_CACHE_TTL_MS });
    return codes;
  }

  /** Dùng trong test hoặc khi vừa đổi quyền và cần hiệu lực ngay */
  clearCache() {
    this.cache.clear();
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const user = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED, 'Bạn chưa đăng nhập.');
    const owned = await this.permissions.codesOf(user.roles);
    if (!required.some((c) => owned.has(c))) {
      const names = required.map((c) => `"${PERMISSION_NAMES[c]}"`).join(' hoặc ');
      throw new AppException(ErrorCode.FORBIDDEN, `Bạn không có quyền ${names} để thực hiện thao tác này.`);
    }
    return true;
  }
}
