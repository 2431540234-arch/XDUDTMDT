-- =====================================================================
-- 06_seed.sql : dữ liệu khởi tạo bắt buộc
-- Có thể chạy lại nhiều lần (ON CONFLICT DO NOTHING).
-- =====================================================================

-- 2 vai trò duy nhất. Khách vãng lai KHÔNG có trong bảng này.
INSERT INTO roles (code, name, description) VALUES
  ('admin', 'Quản trị viên', 'Toàn bộ quyền quản trị hệ thống'),
  ('user',  'Người dùng',    'Mua hàng, giỏ hàng, mã giảm giá, đánh giá, yêu thích, sổ địa chỉ, ảnh AR, lưu không gian mẫu; chỉ thao tác trên dữ liệu của chính mình')
ON CONFLICT (code) DO NOTHING;

-- 6 quyền quản trị
INSERT INTO permissions (code, name, description) VALUES
  ('manage_users',    'Quản lý người dùng',   'Xem, khóa, mở khóa, cấm tài khoản; gán vai trò'),
  ('manage_products', 'Quản lý sản phẩm',     'Sản phẩm, biến thể, tồn kho, mô hình 3D/AR, danh mục, thương hiệu'),
  ('view_orders',     'Xem đơn hàng',         'Xem danh sách và chi tiết đơn hàng'),
  ('process_orders',  'Xử lý đơn hàng',       'Xác nhận, đổi trạng thái, hủy, hoàn tiền, vận chuyển'),
  ('manage_content',  'Quản lý nội dung',     'Trang tĩnh, không gian mẫu, duyệt đánh giá, mã giảm giá'),
  ('manage_settings', 'Cấu hình hệ thống',    'Cấu hình website, kho media, xem nhật ký thao tác')
ON CONFLICT (code) DO NOTHING;

-- Admin có tất cả quyền; user không có quyền nào (không chèn dòng cho user)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Cấu hình mặc định (giá trị JSONB)
INSERT INTO settings (key, value, description) VALUES
  ('site_name',                '"Aurelia Living"'::jsonb,        'Tên website'),
  ('contact_email',            '"support@aurelia.vn"'::jsonb,    'Email liên hệ'),
  ('contact_phone',            '"1900 0000"'::jsonb,             'Số điện thoại liên hệ'),
  ('currency',                 '"VND"'::jsonb,                   'Đơn vị tiền tệ'),
  ('default_shipping_fee',     '150000'::jsonb,                  'Phí vận chuyển mặc định (VND)'),
  ('free_shipping_threshold',  '5000000'::jsonb,                 'Miễn phí vận chuyển cho đơn từ mức này (VND)'),
  ('ar_enabled',               'true'::jsonb,                    'Bật tính năng xem AR'),
  ('maintenance_mode',         'false'::jsonb,                   'Chế độ bảo trì')
ON CONFLICT (key) DO NOTHING;

-- Tài khoản admin mẫu
--   Email   : admin@aurelia.vn
--   Mật khẩu: Admin@123456      (ĐỔI NGAY khi triển khai thật)
-- Chạy trong một transaction để trigger gán vai trò mặc định (deferred) thấy
-- vai trò admin đã được gán và KHÔNG gán thêm vai trò user.
BEGIN;
INSERT INTO users (full_name, email, phone, password_hash, status, email_verified_at)
SELECT 'Quản trị viên', 'admin@aurelia.vn', '0900000000',
       crypt('Admin@123456', gen_salt('bf', 10)), 'active', now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@aurelia.vn' AND deleted_at IS NULL);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u JOIN roles r ON r.code = 'admin'
WHERE u.email = 'admin@aurelia.vn' AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;
COMMIT;
