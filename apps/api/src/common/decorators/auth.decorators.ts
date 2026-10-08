import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { RoleCode } from '@aurelia-living/shared-types';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Người dùng đã xác thực, gắn vào request bởi JwtAuthGuard. */
export interface RequestUser {
  id: number;
  roles: RoleCode[];
}

/** Bỏ qua JwtAuthGuard toàn cục: endpoint công khai (khách vãng lai). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Chỉ cho các vai trò liệt kê, ví dụ @Roles('admin'). */
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);

/** Lấy user hiện tại (hoặc một trường của nó): @CurrentUser() u, @CurrentUser('id') id */
export const CurrentUser = createParamDecorator(
  (field: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    return field ? user?.[field] : user;
  },
);
