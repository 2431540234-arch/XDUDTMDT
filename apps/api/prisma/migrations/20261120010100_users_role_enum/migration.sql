-- Vai trò chuyển vào users.role (enum admin|user): bỏ user_roles, roles, permissions, role_permissions và trigger gán vai trò mặc định.
-- Quyền theo vai trò nay là hằng số ROLE_PERMISSIONS trong code (apps/api/src/common/decorators/permissions.decorator.ts).
-- Thứ tự: thêm cột → backfill → kiểm số dòng → DROP.

-- 1. Thêm cột
CREATE TYPE user_role AS ENUM ('admin', 'user');
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'user';

-- 2. Backfill: có vai trò admin ⇒ admin, còn lại ⇒ user
UPDATE users u
SET role = 'admin'
WHERE EXISTS (
  SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = u.id AND r.code = 'admin'
);

-- 3. Kiểm: số admin khớp; không có vai trò ngoài admin/user
DO $$
DECLARE
  v_old BIGINT;
  v_new BIGINT;
  v_other BIGINT;
BEGIN
  SELECT COUNT(DISTINCT ur.user_id) INTO v_old
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code = 'admin';
  SELECT COUNT(*) INTO v_new FROM users WHERE role = 'admin';
  SELECT COUNT(*) INTO v_other FROM roles WHERE code NOT IN ('admin', 'user');
  IF v_old <> v_new THEN
    RAISE EXCEPTION 'Số admin không khớp: user_roles=% users.role=%', v_old, v_new;
  END IF;
  IF v_other > 0 THEN
    RAISE EXCEPTION 'Có % vai trò ngoài admin/user', v_other;
  END IF;
END;
$$;

-- 4. Trigger/hàm gán vai trò mặc định (nay là DEFAULT 'user' của cột)
DROP TRIGGER IF EXISTS trg_users_assign_default_role ON users;
DROP FUNCTION IF EXISTS trg_users_assign_default_role();

-- 5. Bảng (con trước, cha sau)
DROP TABLE user_roles;
DROP TABLE role_permissions;
DROP TABLE permissions;
DROP TABLE roles;

COMMENT ON COLUMN users.role IS 'Vai trò: admin hoặc user (mặc định user)';
