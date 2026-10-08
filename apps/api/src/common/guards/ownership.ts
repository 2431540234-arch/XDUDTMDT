// Kiểm tra quyền sở hữu: user chỉ thao tác trên dữ liệu của chính mình, admin thao tác trên tất cả.
import { ErrorCode } from '@aurelia-living/shared-types';
import type { RequestUser } from '../decorators/auth.decorators';
import { AppException } from '../exceptions/app.exception';

export function isAdmin(user: RequestUser): boolean {
  return user.roles.includes('admin');
}

/**
 * Gọi trong service sau khi đã nạp bản ghi.
 * Trả 404 (không phải 403) khi không sở hữu để không lộ việc bản ghi có tồn tại.
 */
export function assertOwnerOrAdmin(user: RequestUser, ownerId: number | null | undefined): void {
  if (isAdmin(user)) return;
  if (ownerId == null || ownerId !== user.id) {
    throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không tìm thấy tài nguyên yêu cầu.');
  }
}

/** Điều kiện where thêm vào truy vấn danh sách: user chỉ thấy dữ liệu của mình, admin thấy tất cả. */
export function ownerScope(user: RequestUser, field = 'userId'): Record<string, number> {
  return isAdmin(user) ? {} : { [field]: user.id };
}
