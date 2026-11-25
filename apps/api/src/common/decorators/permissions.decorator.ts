import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/** Sáu quyền chi tiết của admin (DAC_TA mục 2) */
export const PERMISSION_CODES = [
  'manage_users',
  'manage_products',
  'view_orders',
  'process_orders',
  'manage_content',
  'manage_settings',
] as const;
export type PermissionCode = (typeof PERMISSION_CODES)[number];

/** Tên hiển thị tiếng Việt cho thông báo 403  */
export const PERMISSION_NAMES: Record<PermissionCode, string> = {
  manage_users: 'Quản lý người dùng',
  manage_products: 'Quản lý sản phẩm',
  view_orders: 'Xem đơn hàng',
  process_orders: 'Xử lý đơn hàng',
  manage_content: 'Quản lý nội dung',
  manage_settings: 'Cấu hình hệ thống',
};

/**
 * Route/controller chỉ cho người dùng có ÍT NHẤT MỘT trong các quyền liệt kê (theo hằng số ROLE_PERMISSIONS và users.role).
 * Đặt ở method thì ghi đè đặt ở class. Chạy sau JwtAuthGuard và RolesGuard (xem app.module.ts).
 * Ví dụ: @RequirePermission('manage_products'); @RequirePermission('manage_products', 'manage_content') (UC-ADM-04).
 */
export const RequirePermission = (...codes: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, codes);
