-- Mã giảm giá áp cho toàn giỏ (đã bỏ coupon_scopes ở 20261119010100_remove_21_tables): bỏ hai cột phạm vi không còn được ghi/đọc.
ALTER TABLE coupons DROP COLUMN IF EXISTS applies_to;
ALTER TABLE coupons DROP COLUMN IF EXISTS applies_to_label;
