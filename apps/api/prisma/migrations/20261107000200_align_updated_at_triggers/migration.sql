-- QUY_UOC_CODE_DB.md mục 6 / DATABASE_SCHEMA.md mục 6 #1: mọi bảng có cột updated_at đều có trigger tự cập nhật.
-- Vòng lặp trong 0_init chỉ chạy một lần nên bảng thêm sau (return_requests, product_360_configs) bị thiếu.
-- Chạy lại vòng lặp (idempotent: DROP TRIGGER IF EXISTS trước CREATE).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_set_updated_at ON %1$I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_set_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', r.table_name);
  END LOOP;
END
$$;
