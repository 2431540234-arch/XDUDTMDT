// Guard toàn cục: kiểm tra quyền chi tiết (hằng số ROLE_PERMISSIONS theo users.role) của route gắn @RequirePermission(...).
// Route không gắn thì bỏ qua (chỉ đi qua JwtAuthGuard/RolesGuard); test quét metadata để bảo đảm mọi route /admin/* đều có quyền.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type RoleCode } from '@aurelia-living/shared-types';
import type { Request } from 'express';
import { ROLE_PERMISSIONS } from '../auth/role-permissions';
import { PERMISSIONS_KEY, PERMISSION_NAMES, type PermissionCode } from '../decorators/permissions.decorator';
import type { RequestUser } from '../decorators/auth.decorators';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class PermissionsService {
  /** Tập mã quyền của các vai trò (gộp), lấy từ hằng số ROLE_PERMISSIONS */
  codesOf(roles: string[]): Set<string> {
    const codes = new Set<string>();
    for (const r of roles) for (const c of ROLE_PERMISSIONS[r as RoleCode] ?? []) codes.add(c);
    return codes;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const user = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED, 'Bạn chưa đăng nhập.');
    const owned = this.permissions.codesOf(user.roles);
    if (!required.some((c) => owned.has(c))) {
      const names = required.map((c) => `"${PERMISSION_NAMES[c]}"`).join(' hoặc ');
      throw new AppException(ErrorCode.FORBIDDEN, `Bạn không có quyền ${names} để thực hiện thao tác này.`);
    }
    return true;
  }
}
