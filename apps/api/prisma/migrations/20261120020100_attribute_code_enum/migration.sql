-- Bỏ bảng attributes: loại thuộc tính là enum attribute_code (color | size | material) ngay trên attribute_values
-- và variant_attribute_values. Giữ nguyên toàn vẹn: mỗi biến thể một giá trị cho mỗi loại; giá trị thuộc đúng loại (FK ghép).
-- Thuộc tính ngoài ba loại trên (không biến thể nào dùng) bị xóa cùng giá trị của chúng.
-- Thứ tự: thêm cột → backfill → kiểm số dòng → DROP.

-- 1. Thêm cột
CREATE TYPE attribute_code AS ENUM ('color', 'size', 'material');
ALTER TABLE attribute_values ADD COLUMN attribute_code attribute_code;
ALTER TABLE variant_attribute_values ADD COLUMN attribute_code attribute_code;

-- 2. Kiểm: không biến thể nào gắn giá trị của thuộc tính ngoài ba loại
DO $$
DECLARE
  v_bad BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_bad
    FROM variant_attribute_values vav
    JOIN attributes a ON a.id = vav.attribute_id
   WHERE a.code NOT IN ('color', 'size', 'material');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Có % liên kết biến thể thuộc thuộc tính ngoài color/size/material', v_bad;
  END IF;
END;
$$;

-- 3. Xóa giá trị của thuộc tính ngoài ba loại (không còn liên kết), rồi backfill
DELETE FROM attribute_values av
 USING attributes a
 WHERE a.id = av.attribute_id AND a.code NOT IN ('color', 'size', 'material');

UPDATE attribute_values av
   SET attribute_code = a.code::attribute_code
  FROM attributes a
 WHERE a.id = av.attribute_id;

UPDATE variant_attribute_values vav
   SET attribute_code = a.code::attribute_code
  FROM attributes a
 WHERE a.id = vav.attribute_id;

ALTER TABLE attribute_values ALTER COLUMN attribute_code SET NOT NULL;
ALTER TABLE variant_attribute_values ALTER COLUMN attribute_code SET NOT NULL;

-- 4. Kiểm số dòng: mọi liên kết có mã; mã của liên kết khớp mã của giá trị
DO $$
DECLARE
  v_null BIGINT;
  v_mismatch BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_null FROM variant_attribute_values WHERE attribute_code IS NULL;
  SELECT COUNT(*) INTO v_mismatch
    FROM variant_attribute_values vav
    JOIN attribute_values av ON av.id = vav.attribute_value_id
   WHERE av.attribute_code <> vav.attribute_code;
  IF v_null > 0 OR v_mismatch > 0 THEN
    RAISE EXCEPTION 'Backfill sai: null=% lệch=%', v_null, v_mismatch;
  END IF;
END;
$$;

-- 5. Ràng buộc cũ (theo attribute_id) → mới (theo attribute_code)
ALTER TABLE variant_attribute_values DROP CONSTRAINT fk_variant_attribute_values_attribute_value_id;
ALTER TABLE variant_attribute_values DROP CONSTRAINT uq_variant_attribute_values_variant_attribute;
ALTER TABLE variant_attribute_values DROP COLUMN attribute_id;

ALTER TABLE attribute_values DROP CONSTRAINT uq_attribute_values_id_attribute;
ALTER TABLE attribute_values DROP CONSTRAINT uq_attribute_values_attribute_value;
ALTER TABLE attribute_values DROP COLUMN attribute_id;

ALTER TABLE attribute_values
  ADD CONSTRAINT uq_attribute_values_code_value UNIQUE (attribute_code, value),
  ADD CONSTRAINT uq_attribute_values_id_code UNIQUE (id, attribute_code);

ALTER TABLE variant_attribute_values
  ADD CONSTRAINT uq_variant_attribute_values_variant_attribute UNIQUE (variant_id, attribute_code),
  ADD CONSTRAINT fk_variant_attribute_values_attribute_value_id
    FOREIGN KEY (attribute_value_id, attribute_code)
    REFERENCES attribute_values (id, attribute_code) ON DELETE CASCADE;

-- 6. Bảng
DROP TABLE attributes;

COMMENT ON COLUMN attribute_values.attribute_code IS 'Loại thuộc tính: color | size | material';
COMMENT ON COLUMN variant_attribute_values.attribute_code IS 'Loại thuộc tính (khớp attribute_values.attribute_code)';
