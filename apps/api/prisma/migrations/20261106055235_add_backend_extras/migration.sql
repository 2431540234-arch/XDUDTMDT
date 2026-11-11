-- CreateEnum
CREATE TYPE "question_status" AS ENUM ('unanswered', 'answered', 'hidden');

-- CreateEnum
CREATE TYPE "return_type" AS ENUM ('refund', 'exchange');

-- CreateEnum
CREATE TYPE "return_reason" AS ENUM ('defect', 'wrong_item', 'not_as_described', 'missing_accessory', 'change_mind');

-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('pending', 'picking', 'inspecting', 'refunded', 'exchanged', 'rejected');

-- CreateEnum
CREATE TYPE "stock_receipt_type" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "stock_receipt_status" AS ENUM ('draft', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('cogs', 'shipping', 'marketing', 'payment_fee', 'refund', 'other');

-- CreateEnum
CREATE TYPE "banner_position" AS ENUM ('hero-1', 'hero-2', 'hero-3', 'home-left', 'home-right', 'home-3d');

-- AlterEnum
ALTER TYPE "coupon_type" ADD VALUE 'freeship';

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "label" VARCHAR(50) NOT NULL DEFAULT 'Nhà riêng';

-- AlterTable
ALTER TABLE "attribute_values" ADD COLUMN     "color_hex" VARCHAR(7);

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "coupon_id" INTEGER;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "applies_to" VARCHAR(20) NOT NULL DEFAULT 'all',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" VARCHAR(150);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "cost_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "image_media_id" INTEGER,
ADD COLUMN     "variant_label" VARCHAR(255);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "internal_note" TEXT;

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "type" VARCHAR(20) NOT NULL DEFAULT 'static';

-- AlterTable
ALTER TABLE "password_resets" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_sent_at" TIMESTAMPTZ(6),
ADD COLUMN     "otp_hash" VARCHAR(255);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "cost_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "height_cm" DECIMAL(7,1),
ADD COLUMN     "length_cm" DECIMAL(7,1),
ADD COLUMN     "min_stock" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "width_cm" DECIMAL(7,1);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "features" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "style" VARCHAR(50);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "combo_discount_percent" DECIMAL(4,1) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "admin_note" TEXT,
ADD COLUMN     "birthday" DATE,
ADD COLUMN     "gender" VARCHAR(10),
ADD COLUMN     "loyalty_points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "product_specs" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pk_product_specs" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_360_configs" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_rotate" BOOLEAN NOT NULL DEFAULT true,
    "rotation_speed" INTEGER NOT NULL DEFAULT 30,
    "frame_count" INTEGER NOT NULL DEFAULT 36,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_product_360_configs" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_360_frames" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "attribute_value_id" INTEGER NOT NULL,
    "frame_index" INTEGER NOT NULL,
    "media_id" INTEGER NOT NULL,

    CONSTRAINT "pk_product_360_frames" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_images" (
    "id" SERIAL NOT NULL,
    "review_id" INTEGER NOT NULL,
    "media_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pk_review_images" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_questions" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "answer" TEXT,
    "answered_by" VARCHAR(150),
    "answered_at" TIMESTAMPTZ(6),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "status" "question_status" NOT NULL DEFAULT 'unanswered',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_product_questions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_scopes" (
    "id" SERIAL NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "target_type" VARCHAR(20) NOT NULL,
    "target_id" INTEGER NOT NULL,

    CONSTRAINT "pk_coupon_scopes" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_coupons" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "saved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_user_coupons" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_counters" (
    "key" VARCHAR(40) NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "pk_code_counters" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "order_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "return_type" NOT NULL,
    "reason" "return_reason" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "return_status" NOT NULL DEFAULT 'pending',
    "refund_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "admin_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_return_requests" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request_items" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "pk_return_request_items" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request_images" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "media_id" INTEGER NOT NULL,

    CONSTRAINT "pk_return_request_images" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30) NOT NULL DEFAULT '',
    "email" VARCHAR(150) NOT NULL DEFAULT '',
    "address" VARCHAR(255) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_suppliers" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" "stock_receipt_type" NOT NULL,
    "supplier_id" INTEGER,
    "order_code" VARCHAR(30),
    "status" "stock_receipt_status" NOT NULL DEFAULT 'completed',
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_stock_receipts" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipt_items" (
    "id" SERIAL NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost_price" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "pk_stock_receipt_items" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "category" "expense_category" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "order_id" INTEGER,
    "receipt_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_expenses" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(500),
    "image_media_id" INTEGER NOT NULL,
    "link" VARCHAR(500) NOT NULL DEFAULT '/',
    "position" "banner_position" NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_at" TIMESTAMPTZ(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_banners" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(280) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "cover_media_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "author_name" VARCHAR(150) NOT NULL DEFAULT 'Aurelia Living',
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "views" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_posts" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_topics" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pk_faq_topics" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pk_faq_items" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_contact_messages" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_product_specs_product" ON "product_specs"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_360_configs_product" ON "product_360_configs"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_360_frames_media_id" ON "product_360_frames"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_360_frames_slot" ON "product_360_frames"("config_id", "attribute_value_id", "frame_index");

-- CreateIndex
CREATE INDEX "idx_review_images_review_id" ON "review_images"("review_id");

-- CreateIndex
CREATE INDEX "idx_product_questions_product" ON "product_questions"("product_id", "status");

-- CreateIndex
CREATE INDEX "idx_product_questions_status" ON "product_questions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_coupon_scopes" ON "coupon_scopes"("coupon_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_coupons" ON "user_coupons"("user_id", "coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_return_requests_code" ON "return_requests"("code");

-- CreateIndex
CREATE INDEX "idx_return_requests_status" ON "return_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_return_requests_order_id" ON "return_requests"("order_id");

-- CreateIndex
CREATE INDEX "idx_return_requests_user_id" ON "return_requests"("user_id");

-- CreateIndex
CREATE INDEX "idx_return_request_items_request" ON "return_request_items"("request_id");

-- CreateIndex
CREATE INDEX "idx_return_request_images_request" ON "return_request_images"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stock_receipts_code" ON "stock_receipts"("code");

-- CreateIndex
CREATE INDEX "idx_stock_receipts_created" ON "stock_receipts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_stock_receipt_items_receipt" ON "stock_receipt_items"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_expenses_code" ON "expenses"("code");

-- CreateIndex
CREATE INDEX "idx_expenses_date" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "idx_banners_position" ON "banners"("position", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_posts_slug" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "idx_posts_status" ON "posts"("status", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_faq_topics_key" ON "faq_topics"("key");

-- CreateIndex
CREATE INDEX "idx_faq_items_topic" ON "faq_items"("topic_id", "sort_order");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "fk_carts_coupon_id" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_specs" ADD CONSTRAINT "fk_product_specs_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_360_configs" ADD CONSTRAINT "fk_product_360_configs_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_360_frames" ADD CONSTRAINT "fk_product_360_frames_config_id" FOREIGN KEY ("config_id") REFERENCES "product_360_configs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_360_frames" ADD CONSTRAINT "fk_product_360_frames_color_id" FOREIGN KEY ("attribute_value_id") REFERENCES "attribute_values"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_360_frames" ADD CONSTRAINT "fk_product_360_frames_media_id" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "fk_review_images_review_id" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "fk_review_images_media_id" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "fk_product_questions_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "fk_product_questions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_scopes" ADD CONSTRAINT "fk_coupon_scopes_coupon_id" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "fk_user_coupons_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "fk_user_coupons_coupon_id" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "fk_return_requests_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "fk_return_requests_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "fk_return_request_items_request_id" FOREIGN KEY ("request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "fk_return_request_items_order_item_id" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_request_images" ADD CONSTRAINT "fk_return_request_images_request_id" FOREIGN KEY ("request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "return_request_images" ADD CONSTRAINT "fk_return_request_images_media_id" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "fk_stock_receipts_supplier_id" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "fk_stock_receipt_items_receipt_id" FOREIGN KEY ("receipt_id") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "fk_stock_receipt_items_variant_id" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "fk_expenses_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "fk_expenses_receipt_id" FOREIGN KEY ("receipt_id") REFERENCES "stock_receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "fk_banners_image_media_id" FOREIGN KEY ("image_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_cover_media_id" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "fk_faq_items_topic_id" FOREIGN KEY ("topic_id") REFERENCES "faq_topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- =====================================================================
-- Phần viết tay (Prisma không biểu diễn được): CHECK, index tìm kiếm không dấu
-- =====================================================================
ALTER TABLE product_variants
  ADD CONSTRAINT ck_product_variants_cost_price CHECK (cost_price >= 0),
  ADD CONSTRAINT ck_product_variants_min_stock CHECK (min_stock >= 0),
  ADD CONSTRAINT ck_product_variants_reserved CHECK (reserved_quantity >= 0);
ALTER TABLE users ADD CONSTRAINT ck_users_loyalty_points CHECK (loyalty_points >= 0);
ALTER TABLE return_request_items ADD CONSTRAINT ck_return_request_items_qty CHECK (quantity > 0);
ALTER TABLE stock_receipt_items
  ADD CONSTRAINT ck_stock_receipt_items_qty CHECK (quantity > 0),
  ADD CONSTRAINT ck_stock_receipt_items_cost CHECK (cost_price >= 0);
ALTER TABLE expenses ADD CONSTRAINT ck_expenses_amount CHECK (amount >= 0);
ALTER TABLE order_items ADD CONSTRAINT ck_order_items_cost_price CHECK (cost_price >= 0);
ALTER TABLE product_360_frames ADD CONSTRAINT ck_product_360_frames_index CHECK (frame_index >= 0);

-- Tìm sản phẩm không dấu (D-N18): immutable_unaccent() đã tạo ở 0_init
CREATE INDEX idx_products_name_unaccent_trgm ON products USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);
