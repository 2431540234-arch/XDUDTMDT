-- Mã freeship không có giá trị giảm cố định (giảm đúng phí vận chuyển) ⇒ cho phép value = 0 với loại 'freeship'.
-- Chỉ nới ràng buộc CHECK, không đụng dữ liệu.
ALTER TABLE coupons DROP CONSTRAINT ck_coupons_value;
ALTER TABLE coupons ADD CONSTRAINT ck_coupons_value CHECK (value > 0 OR type = 'freeship');
