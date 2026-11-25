-- Thương hiệu thành cột chữ products.brand VARCHAR(150) NULL; bỏ products.brand_id và bảng brands.
-- Thứ tự: thêm cột -> sao chép tên -> kiểm tra số dòng -> xóa cột/bảng cũ.

ALTER TABLE "products" ADD COLUMN "brand" VARCHAR(150);

UPDATE "products" p SET "brand" = b."name" FROM "brands" b WHERE p."brand_id" = b."id";

DO $$
DECLARE
  linked INT;
  copied INT;
BEGIN
  SELECT count(*) INTO linked FROM "products" WHERE "brand_id" IS NOT NULL;
  SELECT count(*) INTO copied FROM "products" WHERE "brand" IS NOT NULL;
  IF linked <> copied THEN
    RAISE EXCEPTION 'Sao chép thương hiệu lệch: % sản phẩm có brand_id nhưng % có brand', linked, copied;
  END IF;
END $$;

ALTER TABLE "products" DROP CONSTRAINT "fk_products_brand_id";
DROP INDEX "idx_products_brand_id";
ALTER TABLE "products" DROP COLUMN "brand_id";
DROP TABLE "brands";
