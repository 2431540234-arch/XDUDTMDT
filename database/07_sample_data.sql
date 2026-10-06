-- =====================================================================
-- 07_sample_data.sql : dữ liệu mẫu để dev/test (KHÔNG chạy trên production)
-- Mật khẩu 2 user mẫu: User@123456
-- Chạy một lần; nếu đã có dữ liệu mẫu thì bỏ qua.
-- =====================================================================

-- Hàm tạm (chỉ tồn tại trong phiên): tạo bản ghi media và trả về id
CREATE OR REPLACE FUNCTION pg_temp.mk_media(p_name text, p_mime text, p_size integer, p_alt text DEFAULT NULL)
RETURNS integer LANGUAGE sql AS $$
  INSERT INTO media (file_name, file_path, mime_type, file_size, alt_text, uploaded_by)
  VALUES (p_name, 'uploads/sample/' || p_name, p_mime, p_size, p_alt,
          (SELECT id FROM users WHERE email = 'admin@aurelia.vn' AND deleted_at IS NULL))
  RETURNING id
$$;

DO $$
DECLARE
  v_admin integer; v_u1 integer; v_u2 integer;
  v_cat_root integer; v_cat_living integer; v_cat_sofa integer; v_cat_table integer;
  v_brand integer;
  v_attr_color integer; v_attr_mat integer;
  v_av_xam integer; v_av_be integer; v_av_soi integer; v_av_oc integer;
  v_p1 integer; v_p2 integer;
  v_v1a integer; v_v1b integer; v_v2a integer; v_v2b integer;
  v_model integer; v_session integer;
  v_space integer; v_pano1 integer; v_pano2 integer;
  v_cart integer; v_coupon integer; v_order integer;
  v_review integer;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email = 'nguyenvana@example.com') THEN
    RAISE NOTICE 'Dữ liệu mẫu đã tồn tại, bỏ qua.';
    RETURN;
  END IF;

  SELECT id INTO v_admin FROM users WHERE email = 'admin@aurelia.vn';

  -- 2 user mẫu (trigger tự gán vai trò user)
  INSERT INTO users (full_name, email, phone, password_hash, email_verified_at)
  VALUES ('Nguyễn Văn A', 'nguyenvana@example.com', '0911111111', crypt('User@123456', gen_salt('bf', 10)), now())
  RETURNING id INTO v_u1;
  INSERT INTO users (full_name, email, phone, password_hash, email_verified_at)
  VALUES ('Trần Thị B', 'tranthib@example.com', '0922222222', crypt('User@123456', gen_salt('bf', 10)), now())
  RETURNING id INTO v_u2;

  INSERT INTO addresses (user_id, recipient_name, phone, province, district, ward, address_line, is_default)
  VALUES (v_u1, 'Nguyễn Văn A', '0911111111', 'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', '12 Lê Lợi', true),
         (v_u1, 'Nguyễn Văn A (cơ quan)', '0911111111', 'TP. Hồ Chí Minh', 'Quận 3', 'Phường 6', '45 Võ Văn Tần', false);

  -- Danh mục cha - con: Nội thất > Phòng khách > Sofa ; Phòng khách > Bàn trà
  INSERT INTO categories (name, slug, sort_order) VALUES ('Nội thất', 'noi-that', 1) RETURNING id INTO v_cat_root;
  INSERT INTO categories (parent_id, name, slug, sort_order) VALUES (v_cat_root, 'Phòng khách', 'phong-khach', 1) RETURNING id INTO v_cat_living;
  INSERT INTO categories (parent_id, name, slug, sort_order) VALUES (v_cat_living, 'Sofa', 'sofa', 1) RETURNING id INTO v_cat_sofa;
  INSERT INTO categories (parent_id, name, slug, sort_order) VALUES (v_cat_living, 'Bàn trà', 'ban-tra', 2) RETURNING id INTO v_cat_table;

  INSERT INTO brands (name, slug, logo_media_id)
  VALUES ('Aurelia Home', 'aurelia-home', pg_temp.mk_media('aurelia-home-logo.png', 'image/png', 20480, 'Logo Aurelia Home'))
  RETURNING id INTO v_brand;

  -- Thuộc tính và giá trị
  INSERT INTO attributes (code, name) VALUES ('color', 'Màu sắc') RETURNING id INTO v_attr_color;
  INSERT INTO attributes (code, name) VALUES ('material', 'Chất liệu') RETURNING id INTO v_attr_mat;
  INSERT INTO attribute_values (attribute_id, value) VALUES (v_attr_color, 'Xám') RETURNING id INTO v_av_xam;
  INSERT INTO attribute_values (attribute_id, value) VALUES (v_attr_color, 'Be')  RETURNING id INTO v_av_be;
  INSERT INTO attribute_values (attribute_id, value) VALUES (v_attr_mat, 'Gỗ sồi')    RETURNING id INTO v_av_soi;
  INSERT INTO attribute_values (attribute_id, value) VALUES (v_attr_mat, 'Gỗ óc chó') RETURNING id INTO v_av_oc;

  -- Sản phẩm 1: Sofa
  INSERT INTO products (name, slug, short_description, description, category_id, brand_id, status, is_featured)
  VALUES ('Sofa Oslo 3 chỗ', 'sofa-oslo-3-cho', 'Sofa vải phong cách Scandinavian',
          'Sofa 3 chỗ khung gỗ tự nhiên, bọc vải chống bám bụi.', v_cat_sofa, v_brand, 'published', true)
  RETURNING id INTO v_p1;
  INSERT INTO product_variants (product_id, sku, price, sale_price, stock_quantity, weight_gram)
  VALUES (v_p1, 'SOFA-OSLO-XAM', 12000000, 10900000, 0, 45000) RETURNING id INTO v_v1a;
  INSERT INTO product_variants (product_id, sku, price, stock_quantity, weight_gram)
  VALUES (v_p1, 'SOFA-OSLO-BE', 12000000, 0, 45000) RETURNING id INTO v_v1b;
  INSERT INTO variant_attribute_values (variant_id, attribute_value_id, attribute_id) VALUES
    (v_v1a, v_av_xam, v_attr_color), (v_v1b, v_av_be, v_attr_color);

  -- Sản phẩm 2: Bàn trà
  INSERT INTO products (name, slug, short_description, description, category_id, brand_id, status)
  VALUES ('Bàn trà Nordic', 'ban-tra-nordic', 'Bàn trà gỗ mặt tròn',
          'Bàn trà gỗ mặt tròn đường kính 80cm, chân gỗ thon.', v_cat_table, v_brand, 'published')
  RETURNING id INTO v_p2;
  INSERT INTO product_variants (product_id, sku, price, stock_quantity, weight_gram)
  VALUES (v_p2, 'BAN-NORDIC-SOI', 3200000, 0, 12000) RETURNING id INTO v_v2a;
  INSERT INTO product_variants (product_id, sku, price, stock_quantity, weight_gram)
  VALUES (v_p2, 'BAN-NORDIC-OC', 3500000, 0, 12500) RETURNING id INTO v_v2b;
  INSERT INTO variant_attribute_values (variant_id, attribute_value_id, attribute_id) VALUES
    (v_v2a, v_av_soi, v_attr_mat), (v_v2b, v_av_oc, v_attr_mat);

  INSERT INTO product_images (product_id, media_id, sort_order, is_primary) VALUES
    (v_p1, pg_temp.mk_media('sofa-oslo.jpg', 'image/jpeg', 350000, 'Sofa Oslo 3 chỗ'), 0, true),
    (v_p2, pg_temp.mk_media('ban-tra-nordic.jpg', 'image/jpeg', 280000, 'Bàn trà Nordic'), 0, true);

  -- Nhập kho ban đầu (Service sẽ làm việc này trong transaction; mẫu ghi tay cho khớp)
  INSERT INTO inventory_movements (variant_id, type, quantity_change, reason, reference_code, performed_by) VALUES
    (v_v1a, 'import', 20, 'Nhập kho ban đầu', 'PN-0001', v_admin),
    (v_v1b, 'import', 20, 'Nhập kho ban đầu', 'PN-0001', v_admin),
    (v_v2a, 'import', 15, 'Nhập kho ban đầu', 'PN-0001', v_admin),
    (v_v2b, 'import', 15, 'Nhập kho ban đầu', 'PN-0001', v_admin);
  UPDATE product_variants SET stock_quantity = 20 WHERE id IN (v_v1a, v_v1b);
  UPDATE product_variants SET stock_quantity = 15 WHERE id IN (v_v2a, v_v2b);

  -- Mô hình 3D của sofa: GLB + USDZ => trigger bật has_3d_model và has_ar
  INSERT INTO product_3d_models (product_id, length_mm, width_mm, height_mm, placement, allow_scaling,
                                 viewer_config, poster_media_id, status, is_primary)
  VALUES (v_p1, 2100, 900, 820, 'floor', false,
          '{"camera_orbit":"45deg 70deg 3m","auto_rotate":true,"exposure":1.0,"shadow_intensity":0.8}'::jsonb,
          pg_temp.mk_media('sofa-oslo-poster.webp', 'image/webp', 60000, 'Ảnh chờ mô hình Sofa Oslo'),
          'ready', true)
  RETURNING id INTO v_model;
  INSERT INTO model_files (model_id, format, lod, media_id, polygon_count, texture_resolution, is_compressed, checksum) VALUES
    (v_model, 'glb',  'high', pg_temp.mk_media('sofa-oslo-high.glb',  'model/gltf-binary', 4200000, 'GLB sofa'), 85000, 2048, true,
       'a3f5c1d2e4b6a8f0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8'),
    (v_model, 'usdz', 'high', pg_temp.mk_media('sofa-oslo-high.usdz', 'model/vnd.usdz+zip', 5100000, 'USDZ sofa'), 85000, 2048, false,
       'b4a6d2e3f5c7b9a1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9');
  INSERT INTO model_material_variants (model_id, variant_id, material_name, config) VALUES
    (v_model, v_v1a, 'fabric_main', '{"baseColor":"#8A8D91","roughness":0.9}'::jsonb),
    (v_model, v_v1b, 'fabric_main', '{"baseColor":"#D9C7A7","roughness":0.9}'::jsonb);

  -- Không gian mẫu: 2 ảnh 360° + đủ 3 loại hotspot + 1 placement
  INSERT INTO spaces (title, slug, description, room_type, style, category_id, cover_media_id, status, published_at)
  VALUES ('Phòng khách tối giản 20m²', 'phong-khach-toi-gian-20m2',
          'Không gian phòng khách phong cách Scandinavian với tông màu trung tính.',
          'living_room', 'Scandinavian', v_cat_living,
          pg_temp.mk_media('space-living-cover.jpg', 'image/jpeg', 400000, 'Ảnh bìa phòng khách'),
          'published', now())
  RETURNING id INTO v_space;
  INSERT INTO space_panoramas (space_id, media_id, title, default_yaw, default_pitch, default_fov, sort_order, is_start)
  VALUES (v_space, pg_temp.mk_media('living-pano-1.jpg', 'image/jpeg', 6500000, '360 phòng khách'), 'Phòng khách', 0, 0, 90, 0, true)
  RETURNING id INTO v_pano1;
  INSERT INTO space_panoramas (space_id, media_id, title, default_yaw, default_pitch, default_fov, sort_order, is_start)
  VALUES (v_space, pg_temp.mk_media('living-pano-2.jpg', 'image/jpeg', 6200000, '360 khu bếp'), 'Khu bếp', 90, -5, 85, 1, false)
  RETURNING id INTO v_pano2;
  INSERT INTO space_hotspots (panorama_id, type, yaw, pitch, product_id, title) VALUES
    (v_pano1, 'product', 15.5, -10, v_p1, 'Sofa Oslo 3 chỗ');
  INSERT INTO space_hotspots (panorama_id, type, yaw, pitch, target_panorama_id, title) VALUES
    (v_pano1, 'navigation', 120, 0, v_pano2, 'Sang khu bếp');
  INSERT INTO space_hotspots (panorama_id, type, yaw, pitch, title, content) VALUES
    (v_pano1, 'info', -45, 5, 'Tường sơn trắng', 'Sơn nước màu trắng sứ, bề mặt mờ.');
  INSERT INTO space_product_placements (panorama_id, product_id, variant_id, model_id, yaw, pitch, distance, rotation_y, scale)
  VALUES (v_pano1, v_p1, v_v1a, v_model, 15.5, -12, 2.8, 180, 1);

  -- Mã giảm giá 10%, tối đa 500.000đ, đơn từ 1.000.000đ
  INSERT INTO coupons (code, type, value, max_discount, min_order_value, usage_limit, per_user_limit, used_count, starts_at, ends_at)
  VALUES ('WELCOME10', 'percent', 10, 500000, 1000000, 1000, 1, 1, now() - interval '30 days', now() + interval '330 days')
  RETURNING id INTO v_coupon;

  -- Giỏ hàng của user B (mỗi user một giỏ)
  INSERT INTO carts (user_id) VALUES (v_u2) RETURNING id INTO v_cart;
  INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (v_cart, v_v1b, 1);

  -- Đơn hàng hoàn chỉnh của user A
  --   subtotal = 10.900.000 (sofa xám, giá sale) + 3.500.000 (bàn trà óc chó) = 14.400.000
  --   giảm 10% = 1.440.000 nhưng bị chặn bởi max_discount => 500.000 ; phí ship 150.000
  --   total = 14.400.000 - 500.000 + 150.000 = 14.050.000
  INSERT INTO orders (order_code, user_id, status, recipient_name, recipient_phone,
                      shipping_province, shipping_district, shipping_ward, shipping_address,
                      subtotal, discount_amount, shipping_fee, total, coupon_id,
                      payment_method, payment_status, note)
  VALUES ('ALV-20261006-0001', v_u1, 'pending', 'Nguyễn Văn A', '0911111111',
          'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', '12 Lê Lợi',
          14400000, 500000, 150000, 14050000, v_coupon,
          'vnpay', 'unpaid', 'Giao giờ hành chính')
  RETURNING id INTO v_order;
  INSERT INTO order_items (order_id, variant_id, product_name, sku, unit_price, quantity) VALUES
    (v_order, v_v1a, 'Sofa Oslo 3 chỗ', 'SOFA-OSLO-XAM', 10900000, 1),
    (v_order, v_v2b, 'Bàn trà Nordic',  'BAN-NORDIC-OC',  3500000, 1);
  INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES (v_coupon, v_u1, v_order);
  INSERT INTO payments (order_id, method, amount, status, transaction_code, gateway_response, paid_at)
  VALUES (v_order, 'vnpay', 14050000, 'success', 'VNP-20261006-0001',
          '{"vnp_ResponseCode":"00","vnp_BankCode":"NCB"}'::jsonb, now());
  UPDATE orders SET payment_status = 'paid' WHERE id = v_order;
  INSERT INTO shipments (order_id, carrier, tracking_code, status, fee, shipped_at, delivered_at)
  VALUES (v_order, 'ghn', 'GHN123456789', 'delivered', 150000, now() - interval '2 days', now());

  -- Vòng đời đơn: mỗi lần đổi trạng thái trigger tự ghi order_status_history
  UPDATE orders SET status = 'confirmed'  WHERE id = v_order;
  UPDATE orders SET status = 'processing' WHERE id = v_order;
  UPDATE orders SET status = 'shipping'   WHERE id = v_order;
  UPDATE orders SET status = 'completed'  WHERE id = v_order;

  -- Trừ kho + tăng sold_count (việc của tầng Service; ghi tay cho dữ liệu mẫu nhất quán)
  INSERT INTO inventory_movements (variant_id, type, quantity_change, reason, reference_code) VALUES
    (v_v1a, 'sale', -1, 'Bán hàng', 'ALV-20261006-0001'),
    (v_v2b, 'sale', -1, 'Bán hàng', 'ALV-20261006-0001');
  UPDATE product_variants SET stock_quantity = stock_quantity - 1 WHERE id IN (v_v1a, v_v2b);
  UPDATE products SET sold_count = sold_count + 1 WHERE id IN (v_p1, v_p2);

  INSERT INTO notifications (user_id, title, data)
  VALUES (v_u1, 'Đơn hàng ALV-20261006-0001 đã được giao', jsonb_build_object('order_id', v_order, 'type', 'order_delivered'));

  -- Review: tạo ở trạng thái pending rồi duyệt => trigger cập nhật rating_avg/rating_count
  INSERT INTO reviews (user_id, product_id, order_id, rating, content, status)
  VALUES (v_u1, v_p1, v_order, 5, 'Sofa êm, đúng kích thước như xem AR.', 'pending')
  RETURNING id INTO v_review;
  UPDATE reviews SET status = 'approved' WHERE id = v_review;

  INSERT INTO wishlists (user_id, product_id) VALUES (v_u1, v_p2);
  INSERT INTO space_bookmarks (user_id, space_id) VALUES (v_u1, v_space);

  -- Thống kê AR: 1 phiên của user (chụp ảnh), 1 phiên của khách vãng lai (chỉ có visitor_id)
  INSERT INTO ar_sessions (user_id, product_id, model_id, device, os, ar_platform, mode, duration_seconds, placed, captured, added_to_cart)
  VALUES (v_u1, v_p1, v_model, 'iPhone 15', 'iOS 18', 'quick_look', 'ar', 95, true, true, true)
  RETURNING id INTO v_session;
  INSERT INTO ar_sessions (visitor_id, product_id, model_id, device, os, ar_platform, mode, duration_seconds)
  VALUES ('5b3f1c1e-8a47-4c0e-9d5f-0c6b7d1e2a33', v_p1, v_model, 'Pixel 8', 'Android 15', 'scene_viewer', 'view_3d', 30);
  INSERT INTO ar_snapshots (user_id, product_id, ar_session_id, media_id, is_public)
  VALUES (v_u1, v_p1, v_session, pg_temp.mk_media('ar-snapshot-1.jpg', 'image/jpeg', 520000, 'Sofa đặt trong phòng khách'), true);

  -- Lượt xem space: khách vãng lai (user_id NULL + visitor_id) và user; trigger tăng spaces.view_count
  INSERT INTO space_views (space_id, user_id, visitor_id, source_product_id, hotspot_click_count, added_to_cart)
  VALUES (v_space, NULL, '5b3f1c1e-8a47-4c0e-9d5f-0c6b7d1e2a33', v_p1, 1, false);
  INSERT INTO space_views (space_id, user_id, source_product_id, hotspot_click_count, added_to_cart)
  VALUES (v_space, v_u1, v_p1, 3, true);

  -- Trang tĩnh và nhật ký thao tác admin
  INSERT INTO pages (title, slug, content, status, published_at)
  VALUES ('Chính sách đổi trả', 'chinh-sach-doi-tra', '<p>Đổi trả trong 7 ngày nếu sản phẩm lỗi do nhà sản xuất.</p>', 'published', now());
  INSERT INTO activity_logs (actor_id, action, target_type, target_id, changes, ip_address)
  VALUES (v_admin, 'product.create', 'products', v_p1, '{"after":{"name":"Sofa Oslo 3 chỗ"}}'::jsonb, '127.0.0.1');
END;
$$;
