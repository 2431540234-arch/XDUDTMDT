// Unit test PermissionsGuard/PermissionsService: quyền đọc từ role_permissions, any-of, 403 tiếng Việt, cache ngắn hạn.
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequirePermission } from '../decorators/permissions.decorator';
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

function setup(codes: string[]) {
  const findMany = jest.fn(async () => codes.map((code) => ({ permission: { code } })));
  const service = new PermissionsService({ rolePermission: { findMany } } as never);
  return { guard: new PermissionsGuard(new Reflector(), service), service, findMany };
}

describe('PermissionsGuard', () => {
  it('route không gắn quyền: cho qua và không truy vấn DB', async () => {
    const { guard, findMany } = setup([]);
    await expect(guard.canActivate(ctxOf(plain(), { id: 1, roles: ['admin'] }))).resolves.toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('có quyền yêu cầu: cho qua; thiếu: 403 FORBIDDEN, thông báo tiếng Việt nêu tên quyền', async () => {
    const ok = setup(['manage_products']);
    await expect(
      ok.guard.canActivate(ctxOf(handlerWith('manage_products'), { id: 1, roles: ['admin'] })),
    ).resolves.toBe(true);
    const no = setup(['view_orders']);
    await expect(
      no.guard.canActivate(ctxOf(handlerWith('manage_products'), { id: 1, roles: ['admin'] })),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền "Quản lý sản phẩm" để thực hiện thao tác này.',
    });
  });

  it('nhiều quyền là "một trong": chỉ cần có một', async () => {
    const { guard } = setup(['manage_content']);
    await expect(
      guard.canActivate(ctxOf(handlerWith('manage_products', 'manage_content'), { id: 1, roles: ['admin'] })),
    ).resolves.toBe(true);
  });

  it('chưa đăng nhập: AUTH_UNAUTHENTICATED', async () => {
    const { guard } = setup([]);
    await expect(guard.canActivate(ctxOf(handlerWith('manage_users'), undefined))).rejects.toMatchObject({
      code: 'AUTH_UNAUTHENTICATED',
    });
  });

  it('quyền đặt ở method ghi đè quyền ở class', async () => {
    class C {
      @RequirePermission('view_orders')
      m() {}
    }
    Reflect.defineMetadata('requiredPermissions', ['process_orders'], C);
    const { guard } = setup(['view_orders']);
    await expect(guard.canActivate(ctxOf(C.prototype.m, { id: 1, roles: ['admin'] }, C))).resolves.toBe(true);
  });

  it('cache bộ nhớ ngắn hạn: gọi lặp không truy vấn lại; clearCache() đọc lại DB', async () => {
    const { guard, service, findMany } = setup(['manage_users']);
    const ctx = ctxOf(handlerWith('manage_users'), { id: 1, roles: ['admin'] });
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    expect(findMany).toHaveBeenCalledTimes(1);
    service.clearCache();
    await guard.canActivate(ctx);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
