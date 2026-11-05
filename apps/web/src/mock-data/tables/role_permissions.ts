// Bảng `permissions` / `role_permissions` có trong DB nhưng KHÔNG dựng giao diện phân quyền (chỉ 2 vai trò). Mảng rỗng.
import type { Permission, RolePermission } from '@aurelia-living/shared-types';

export const permissions: Permission[] = [];
export const rolePermissions: RolePermission[] = [];
