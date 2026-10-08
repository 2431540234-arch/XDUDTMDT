// Bọc mọi response thành công: { success: true, data, meta? }.
// Handler trả về `paginated(items, page, pageSize, total)` thì meta được tách ra; giá trị thường thì chỉ có data.
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { ApiResponse, PaginatedMeta } from '@aurelia-living/shared-types';
import { map, Observable } from 'rxjs';

const PAGINATED = Symbol('paginated');

export interface Paginated<T> {
  [PAGINATED]: true;
  items: T[];
  meta: PaginatedMeta;
}

export function paginated<T>(items: T[], page: number, pageSize: number, total: number): Paginated<T> {
  return {
    [PAGINATED]: true,
    items,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

function isPaginated(v: unknown): v is Paginated<unknown> {
  return typeof v === 'object' && v !== null && (v as Record<symbol, unknown>)[PAGINATED] === true;
}

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown> | StreamableFile> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof StreamableFile) return value;
        if (isPaginated(value)) return { success: true as const, data: value.items, meta: value.meta };
        return { success: true as const, data: value === undefined ? null : value };
      }),
    );
  }
}
