// Lưới an toàn nhật ký thao tác (DAC_TA mục 9; QUY_UOC §8). Mọi service ghi nhật ký TRỰC TIẾP trong transaction (D-T52) và
// KHÔNG bị thay thế: interceptor chỉ ghi một dòng chung khi request ghi (POST/PUT/PATCH/DELETE) của admin thành công
// mà service KHÔNG gọi ActivityLogService.log. Request lỗi hoặc đã có log từ service thì bỏ qua (không ghi trùng).
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, concatMap } from 'rxjs';
import type { RequestUser } from '../common/decorators/auth.decorators';
import { ActivityLogService } from './activity-log.service';
import { activityLogContext, type ActivityLogContext } from './activity-log.context';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const VERB_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** "/api/admin/orders/:id/cancel" → { resource: "orders", action: "orders.cancel" } */
export function describeRoute(method: string, routePath: string): { resource: string; action: string } {
  const segs = routePath
    .replace(/^\/?api\//, '')
    .replace(/^\/?admin\//, '')
    .split('/')
    .filter(Boolean);
  const statics = segs.filter((s) => !s.startsWith(':'));
  const resource = statics[0] ?? 'admin';
  // route có động từ ở cuối (…/:id/cancel, /reorder) lấy làm hành động, ngược lại theo phương thức HTTP
  const last = segs[segs.length - 1];
  const verb =
    statics.length > 1 && !last.startsWith(':') ? last : (VERB_BY_METHOD[method] ?? method.toLowerCase());
  return { resource, action: `${resource}.${verb}` };
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  constructor(private readonly activity: ActivityLogService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestUser; route?: { path?: string } }>();
    const isAdminWrite =
      WRITE_METHODS.has(req.method) && /^\/(api\/)?admin\//.test(req.originalUrl ?? req.url ?? '');
    if (!isAdminWrite) return next.handle();

    const store: ActivityLogContext = { logged: false };
    // handler chạy trong ngữ cảnh riêng của request này; log() của service đánh dấu store.logged
    return new Observable((subscriber) =>
      activityLogContext.run(store, () => next.handle().subscribe(subscriber)),
    ).pipe(
      // chỉ chạy khi handler thành công (lỗi đi thẳng xuống bộ lọc lỗi, không qua concatMap)
      concatMap(async (value) => {
        if (!store.logged && req.user?.roles?.includes('admin')) await this.fallback(req);
        return value;
      }),
    );
  }

  private async fallback(req: Request & { user?: RequestUser; route?: { path?: string } }) {
    try {
      const routePath = req.route?.path ?? req.originalUrl.split('?')[0];
      const { resource, action } = describeRoute(req.method, String(routePath));
      const rawId = Number((req.params as Record<string, string>)?.id);
      await this.activity.log({
        actorId: req.user!.id,
        action,
        targetType: resource,
        targetId: Number.isInteger(rawId) && rawId > 0 ? rawId : undefined,
        changes: { auto: true, method: req.method, route: String(routePath) },
        ipAddress: req.ip || undefined,
      });
    } catch (e) {
      // lưới an toàn không được làm hỏng một thao tác đã thành công
      this.logger.error(`Không ghi được nhật ký tự động: ${(e as Error).message}`);
    }
  }
}
