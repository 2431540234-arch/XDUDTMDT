// Unit test PermissionsGuard/PermissionsService: quyền theo hằng số ROLE_PERMISSIONS và users.role, any-of, 403 tiếng Việt.
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_PERMISSIONS } from '../auth/role-permissions';
import { PERMISSION_CODES, RequirePermission } from '../decorators/permissions.decorator';
import { PermissionsGuard, PermissionsService } from './permissions.guard';

function ctxOf(handler: object, user: unknown, cls: object = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}
const handlerWith = (...codes: Parameters<typeof RequirePermission>) => {
  class C {
    @RequirePermission(...codes)
    m() {}
  }
  return C.prototype.m;
};
const plain = () => {
  class C {
    m() {}
  }
  return C.prototype.m;
};

const guard = new PermissionsGuard(new Reflector(), new PermissionsService());
const admin = { id: 1, roles: ['admin'] };
const customer = { id: 2, roles: ['user'] };

describe('ROLE_PERMISSIONS', () => {
  it('admin có đủ 6 quyền; user không có quyền quản trị', () => {
    expect([...ROLE_PERMISSIONS.admin].sort()).toEqual([...PERMISSION_CODES].sort());
    expect(PERMISSION_CODES).toHaveLength(6);
    expect(ROLE_PERMISSIONS.user).toEqual([]);
  });
});

describe('PermissionsGuard', () => {
  it('route không gắn quyền: cho qua', () => {
    expect(guard.canActivate(ctxOf(plain(), customer))).toBe(true);
  });

  it('admin có quyền yêu cầu: cho qua', () => {
    expect(guard.canActivate(ctxOf(handlerWith('manage_products'), admin))).toBe(true);
  });

  it('user thiếu quyền: 403 FORBIDDEN, thông báo tiếng Việt nêu tên quyền', () => {
    expect(() => guard.canActivate(ctxOf(handlerWith('manage_products'), customer))).toThrow(
      'Bạn không có quyền "Quản lý sản phẩm" để thực hiện thao tác này.',
    );
  });

  it('nhiều quyền là "một trong": thông báo nêu tất cả', () => {
    expect(() =>
      guard.canActivate(ctxOf(handlerWith('manage_products', 'manage_content'), customer)),
    ).toThrow('"Quản lý sản phẩm" hoặc "Quản lý nội dung"');
    expect(guard.canActivate(ctxOf(handlerWith('manage_products', 'manage_content'), admin))).toBe(true);
  });

  it('chưa đăng nhập: AUTH_UNAUTHENTICATED', () => {
    expect(() => guard.canActivate(ctxOf(handlerWith('manage_users'), undefined))).toThrow(
      'Bạn chưa đăng nhập.',
    );
  });

  it('quyền đặt ở method ghi đè quyền ở class', () => {
    class C {
      @RequirePermission('view_orders')
      m() {}
    }
    Reflect.defineMetadata('requiredPermissions', ['process_orders'], C);
    expect(guard.canActivate(ctxOf(C.prototype.m, admin, C))).toBe(true);
  });
});
