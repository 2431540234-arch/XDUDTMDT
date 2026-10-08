// Guard toàn cục: route gắn @Roles(...) chỉ cho phép user có ít nhất một vai trò trong danh sách.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type RoleCode } from '@aurelia-living/shared-types';
import type { Request } from 'express';
import { ROLES_KEY, type RequestUser } from '../decorators/auth.decorators';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const user = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED, 'Bạn chưa đăng nhập.');
    if (!user.roles.some((r) => required.includes(r))) {
      throw new AppException(ErrorCode.FORBIDDEN, 'Bạn không có quyền thực hiện thao tác này.');
    }
    return true;
  }
}
