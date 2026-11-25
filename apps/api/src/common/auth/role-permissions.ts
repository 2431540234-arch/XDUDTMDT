// Vai trò và quyền là hằng số trong code (thay cho các bảng roles, permissions, role_permissions, user_roles đã bỏ).
// Mỗi người dùng có đúng một vai trò: users.role (enum admin | user). Khách vãng lai không có tài khoản.
import type { RoleCode } from '@aurelia-living/shared-types';
import { PERMISSION_CODES, type PermissionCode } from '../decorators/permissions.decorator';

/** Mô tả hiển thị của từng quyền (GET /admin/roles) */
export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  manage_users: 'Xem, khóa, mở khóa, cấm tài khoản; gán vai trò',
  manage_products: 'Sản phẩm, biến thể, tồn kho, mô hình 3D/AR, danh mục, thương hiệu',
  view_orders: 'Xem danh sách và chi tiết đơn hàng',
  process_orders: 'Xác nhận, đổi trạng thái, hủy, hoàn tiền, vận chuyển',
  manage_content: 'Trang tĩnh, không gian mẫu, duyệt đánh giá, mã giảm giá',
  manage_settings: 'Cấu hình website, kho media, xem nhật ký thao tác',
};

/** Quyền theo vai trò: admin có toàn bộ quyền; user không có quyền quản trị (chỉ thao tác trên dữ liệu của chính mình) */
export const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  admin: PERMISSION_CODES,
  user: [],
};

/** Thông tin hiển thị của vai trò (id giữ nguyên số cũ để không đổi hợp đồng API) */
export const ROLE_INFO: Record<RoleCode, { id: number; name: string; description: string }> = {
  admin: { id: 1, name: 'Quản trị viên', description: 'Toàn bộ quyền quản trị hệ thống' },
  user: {
    id: 2,
    name: 'Người dùng',
    description:
      'Mua hàng, giỏ hàng, mã giảm giá, đánh giá, yêu thích, sổ địa chỉ, ảnh AR, lưu không gian mẫu; chỉ thao tác trên dữ liệu của chính mình',
  },
};

export const ROLE_CODES: readonly RoleCode[] = ['admin', 'user'];
