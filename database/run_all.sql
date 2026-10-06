-- =====================================================================
-- run_all.sql : dựng toàn bộ CSDL (01 -> 07)
-- Cách chạy (đường dẫn tính theo vị trí file này nhờ \ir, chạy từ thư mục nào cũng được):
--   psql -U postgres -d ten_db -f database/run_all.sql
-- Làm sạch trước khi dựng lại (chỉ dev):  psql ... -f database/00_reset.sql
-- =====================================================================
\set ON_ERROR_STOP on
\encoding UTF8
-- Ẩn NOTICE "does not exist, skipping" của DROP ... IF EXISTS khi chạy lần đầu
SET client_min_messages = warning;

\ir 01_extensions.sql
\ir 02_types.sql
\ir 03_tables.sql
\ir 04_constraints_indexes.sql
\ir 05_functions_triggers.sql
\ir 06_seed.sql
\ir 07_sample_data.sql
