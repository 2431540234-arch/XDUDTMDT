-- =====================================================================
-- 02_types.sql : toàn bộ kiểu ENUM
-- Bọc DO ... EXCEPTION duplicate_object để chạy lại không lỗi
-- (CREATE TYPE không có IF NOT EXISTS).
-- =====================================================================

-- Nhóm 1
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dùng chung cho pages, products, spaces (cùng vòng đời nháp -> đăng -> lưu trữ)
DO $$ BEGIN CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 4
DO $$ BEGIN CREATE TYPE inventory_movement_type AS ENUM ('import', 'sale', 'return', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 5
DO $$ BEGIN CREATE TYPE model_placement AS ENUM ('floor', 'wall', 'table');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE model_status AS ENUM ('uploading', 'processing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE model_file_format AS ENUM ('glb', 'usdz');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE model_lod AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ar_mode AS ENUM ('view_3d', 'ar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 6
DO $$ BEGIN CREATE TYPE coupon_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE order_status AS ENUM
  ('pending', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trạng thái thanh toán ở mức đơn hàng (orders.payment_status)
DO $$ BEGIN CREATE TYPE order_payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_method AS ENUM
  ('cod', 'bank_transfer', 'momo', 'vnpay', 'zalopay', 'card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trạng thái của từng giao dịch (payments.status)
DO $$ BEGIN CREATE TYPE payment_txn_status AS ENUM ('pending', 'success', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE shipment_carrier AS ENUM ('ghn', 'ghtk', 'viettel_post', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE shipment_status AS ENUM
  ('pending', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 7
DO $$ BEGIN CREATE TYPE room_type AS ENUM
  ('living_room', 'bedroom', 'kitchen', 'dining_room', 'bathroom', 'office', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE hotspot_type AS ENUM ('product', 'navigation', 'info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
