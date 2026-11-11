-- QUY_UOC_CODE_DB.md mục 7: bảng/cột mới phải có COMMENT ON tiếng Việt. Chỉ thêm metadata, không đổi dữ liệu.

-- ===== Bảng mới =====
COMMENT ON TABLE product_specs IS 'Thông số kỹ thuật của sản phẩm (cặp nhãn - giá trị) hiển thị ở trang chi tiết';
COMMENT ON COLUMN product_specs.id IS 'Khóa chính';
COMMENT ON COLUMN product_specs.product_id IS 'Sản phẩm';
COMMENT ON COLUMN product_specs.label IS 'Tên thông số, ví dụ Chất liệu';
COMMENT ON COLUMN product_specs.value IS 'Giá trị thông số';
COMMENT ON COLUMN product_specs.sort_order IS 'Thứ tự hiển thị';

COMMENT ON TABLE product_360_configs IS 'Cấu hình xem 360° của sản phẩm (mỗi sản phẩm tối đa một cấu hình)';
COMMENT ON COLUMN product_360_configs.id IS 'Khóa chính';
COMMENT ON COLUMN product_360_configs.product_id IS 'Sản phẩm (duy nhất)';
COMMENT ON COLUMN product_360_configs.enabled IS 'Bật/tắt xem 360° ở trang sản phẩm';
COMMENT ON COLUMN product_360_configs.auto_rotate IS 'Tự xoay khi mở';
COMMENT ON COLUMN product_360_configs.rotation_speed IS 'Tốc độ tự xoay (độ/giây)';
COMMENT ON COLUMN product_360_configs.frame_count IS 'Số khung hình mỗi màu (24 hoặc 36)';
COMMENT ON COLUMN product_360_configs.default_color_id IS 'Giá trị thuộc tính màu mặc định khi mở trang 360°';
COMMENT ON COLUMN product_360_configs.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN product_360_configs.updated_at IS 'Thời điểm cập nhật cuối (trigger tự cập nhật)';

COMMENT ON TABLE product_360_frames IS 'Các khung ảnh 360° của sản phẩm theo từng màu, theo thứ tự góc xoay';
COMMENT ON COLUMN product_360_frames.id IS 'Khóa chính';
COMMENT ON COLUMN product_360_frames.config_id IS 'Cấu hình 360° chứa khung ảnh';
COMMENT ON COLUMN product_360_frames.attribute_value_id IS 'Giá trị thuộc tính màu mà khung ảnh thuộc về';
COMMENT ON COLUMN product_360_frames.frame_index IS 'Thứ tự khung (0 = góc đầu tiên)';
COMMENT ON COLUMN product_360_frames.media_id IS 'Tệp ảnh trong kho media';

COMMENT ON TABLE review_images IS 'Ảnh đính kèm của đánh giá sản phẩm (tối đa 5 ảnh mỗi đánh giá)';
COMMENT ON COLUMN review_images.id IS 'Khóa chính';
COMMENT ON COLUMN review_images.review_id IS 'Đánh giá';
COMMENT ON COLUMN review_images.media_id IS 'Tệp ảnh trong kho media';
COMMENT ON COLUMN review_images.sort_order IS 'Thứ tự hiển thị';

COMMENT ON TABLE product_questions IS 'Câu hỏi của khách về sản phẩm và câu trả lời của quản trị viên';
COMMENT ON COLUMN product_questions.id IS 'Khóa chính';
COMMENT ON COLUMN product_questions.product_id IS 'Sản phẩm được hỏi';
COMMENT ON COLUMN product_questions.user_id IS 'Người dùng đặt câu hỏi (phải đăng nhập)';
COMMENT ON COLUMN product_questions.content IS 'Nội dung câu hỏi';
COMMENT ON COLUMN product_questions.answer IS 'Nội dung trả lời';
COMMENT ON COLUMN product_questions.answered_by IS 'Tên người trả lời';
COMMENT ON COLUMN product_questions.answered_at IS 'Thời điểm trả lời';
COMMENT ON COLUMN product_questions.is_public IS 'Hiển thị công khai ở trang sản phẩm (chỉ khi đã trả lời)';
COMMENT ON COLUMN product_questions.status IS 'Trạng thái: unanswered (chưa trả lời), answered (đã trả lời), hidden (ẩn)';
COMMENT ON COLUMN product_questions.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE coupon_scopes IS 'Phạm vi áp dụng của mã giảm giá theo sản phẩm, danh mục hoặc không gian mẫu';
COMMENT ON COLUMN coupon_scopes.id IS 'Khóa chính';
COMMENT ON COLUMN coupon_scopes.coupon_id IS 'Mã giảm giá';
COMMENT ON COLUMN coupon_scopes.target_type IS 'Loại đối tượng: product, category hoặc space';
COMMENT ON COLUMN coupon_scopes.target_id IS 'Id của đối tượng (khóa đa hình nên không có khóa ngoại)';

COMMENT ON TABLE user_coupons IS 'Mã giảm giá mà người dùng đã lưu vào ví của mình';
COMMENT ON COLUMN user_coupons.id IS 'Khóa chính';
COMMENT ON COLUMN user_coupons.user_id IS 'Người dùng';
COMMENT ON COLUMN user_coupons.coupon_id IS 'Mã giảm giá đã lưu';
COMMENT ON COLUMN user_coupons.saved_at IS 'Thời điểm lưu';

COMMENT ON TABLE code_counters IS 'Bộ đếm cấp mã tăng dần an toàn khi đồng thời (mã đơn theo ngày, mã đổi trả, phiếu kho, phiếu chi)';
COMMENT ON COLUMN code_counters.key IS 'Khóa bộ đếm, ví dụ ORD:20261106 hoặc RT';
COMMENT ON COLUMN code_counters.value IS 'Giá trị đã cấp gần nhất';

COMMENT ON TABLE return_requests IS 'Yêu cầu đổi trả/hoàn tiền của khách cho một đơn hàng đã giao';
COMMENT ON COLUMN return_requests.id IS 'Khóa chính';
COMMENT ON COLUMN return_requests.code IS 'Mã yêu cầu dạng RT0001 (duy nhất)';
COMMENT ON COLUMN return_requests.order_id IS 'Đơn hàng';
COMMENT ON COLUMN return_requests.user_id IS 'Khách gửi yêu cầu';
COMMENT ON COLUMN return_requests.type IS 'Hình thức: refund (trả hàng hoàn tiền) hoặc exchange (đổi hàng)';
COMMENT ON COLUMN return_requests.reason IS 'Lý do đổi trả';
COMMENT ON COLUMN return_requests.description IS 'Mô tả chi tiết của khách';
COMMENT ON COLUMN return_requests.status IS 'Trạng thái: pending, picking, inspecting, refunded, exchanged, rejected';
COMMENT ON COLUMN return_requests.refund_amount IS 'Số tiền hoàn dự kiến (VNĐ)';
COMMENT ON COLUMN return_requests.admin_note IS 'Ghi chú/lý do từ chối của quản trị viên';
COMMENT ON COLUMN return_requests.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN return_requests.updated_at IS 'Thời điểm cập nhật cuối (trigger tự cập nhật)';

COMMENT ON TABLE return_request_items IS 'Các dòng sản phẩm và số lượng trong yêu cầu đổi trả';
COMMENT ON COLUMN return_request_items.id IS 'Khóa chính';
COMMENT ON COLUMN return_request_items.request_id IS 'Yêu cầu đổi trả';
COMMENT ON COLUMN return_request_items.order_item_id IS 'Dòng sản phẩm trong đơn hàng gốc';
COMMENT ON COLUMN return_request_items.quantity IS 'Số lượng đổi trả (> 0, không vượt số đã mua trừ số đã yêu cầu)';

COMMENT ON TABLE return_request_images IS 'Ảnh/video minh chứng của yêu cầu đổi trả';
COMMENT ON COLUMN return_request_images.id IS 'Khóa chính';
COMMENT ON COLUMN return_request_images.request_id IS 'Yêu cầu đổi trả';
COMMENT ON COLUMN return_request_images.media_id IS 'Tệp minh chứng trong kho media';

COMMENT ON TABLE suppliers IS 'Nhà cung cấp hàng nhập kho';
COMMENT ON COLUMN suppliers.id IS 'Khóa chính';
COMMENT ON COLUMN suppliers.name IS 'Tên nhà cung cấp';
COMMENT ON COLUMN suppliers.phone IS 'Số điện thoại';
COMMENT ON COLUMN suppliers.email IS 'Email';
COMMENT ON COLUMN suppliers.address IS 'Địa chỉ';
COMMENT ON COLUMN suppliers.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE stock_receipts IS 'Phiếu nhập/xuất kho (chứng từ gom nhiều dòng biến động tồn kho)';
COMMENT ON COLUMN stock_receipts.id IS 'Khóa chính';
COMMENT ON COLUMN stock_receipts.code IS 'Mã phiếu (duy nhất)';
COMMENT ON COLUMN stock_receipts.type IS 'Loại phiếu: in (nhập) hoặc out (xuất)';
COMMENT ON COLUMN stock_receipts.supplier_id IS 'Nhà cung cấp (phiếu nhập)';
COMMENT ON COLUMN stock_receipts.order_code IS 'Mã đơn hàng liên quan (phiếu xuất)';
COMMENT ON COLUMN stock_receipts.status IS 'Trạng thái: draft, completed, cancelled';
COMMENT ON COLUMN stock_receipts.created_by IS 'Quản trị viên lập phiếu';
COMMENT ON COLUMN stock_receipts.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE stock_receipt_items IS 'Các dòng biến thể và số lượng của phiếu kho';
COMMENT ON COLUMN stock_receipt_items.id IS 'Khóa chính';
COMMENT ON COLUMN stock_receipt_items.receipt_id IS 'Phiếu kho';
COMMENT ON COLUMN stock_receipt_items.variant_id IS 'Biến thể sản phẩm';
COMMENT ON COLUMN stock_receipt_items.quantity IS 'Số lượng (> 0)';
COMMENT ON COLUMN stock_receipt_items.cost_price IS 'Giá nhập một đơn vị (VNĐ)';

COMMENT ON TABLE expenses IS 'Phiếu chi phục vụ báo cáo thu chi (hoàn tiền, vận chuyển, marketing, phí thanh toán...)';
COMMENT ON COLUMN expenses.id IS 'Khóa chính';
COMMENT ON COLUMN expenses.code IS 'Mã phiếu chi (duy nhất)';
COMMENT ON COLUMN expenses.category IS 'Danh mục chi: cogs, shipping, marketing, payment_fee, refund, other';
COMMENT ON COLUMN expenses.amount IS 'Số tiền chi (VNĐ, >= 0)';
COMMENT ON COLUMN expenses.note IS 'Ghi chú';
COMMENT ON COLUMN expenses.date IS 'Ngày chi';
COMMENT ON COLUMN expenses.order_id IS 'Đơn hàng liên quan (ví dụ phiếu chi hoàn tiền)';
COMMENT ON COLUMN expenses.receipt_id IS 'Phiếu nhập kho liên quan';
COMMENT ON COLUMN expenses.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE banners IS 'Banner/slider trang chủ do quản trị viên quản lý';
COMMENT ON COLUMN banners.id IS 'Khóa chính';
COMMENT ON COLUMN banners.title IS 'Tiêu đề banner';
COMMENT ON COLUMN banners.subtitle IS 'Dòng mô tả phụ';
COMMENT ON COLUMN banners.image_media_id IS 'Ảnh banner trong kho media';
COMMENT ON COLUMN banners.link IS 'Đường dẫn khi bấm vào banner';
COMMENT ON COLUMN banners.position IS 'Vị trí hiển thị (hero-1..3, home-left, home-right, home-3d)';
COMMENT ON COLUMN banners.start_at IS 'Bắt đầu hiển thị';
COMMENT ON COLUMN banners.end_at IS 'Kết thúc hiển thị (NULL = không giới hạn)';
COMMENT ON COLUMN banners.sort_order IS 'Thứ tự trong cùng vị trí';
COMMENT ON COLUMN banners.is_active IS 'Bật/tắt banner';
COMMENT ON COLUMN banners.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE posts IS 'Bài viết/cảm hứng (blog) của website';
COMMENT ON COLUMN posts.id IS 'Khóa chính';
COMMENT ON COLUMN posts.title IS 'Tiêu đề';
COMMENT ON COLUMN posts.slug IS 'Đường dẫn thân thiện (duy nhất)';
COMMENT ON COLUMN posts.category IS 'Chuyên mục';
COMMENT ON COLUMN posts.cover_media_id IS 'Ảnh bìa trong kho media';
COMMENT ON COLUMN posts.content IS 'Nội dung bài viết';
COMMENT ON COLUMN posts.author_name IS 'Tên tác giả hiển thị';
COMMENT ON COLUMN posts.status IS 'Trạng thái: draft, published, archived';
COMMENT ON COLUMN posts.views IS 'Số lượt xem';
COMMENT ON COLUMN posts.published_at IS 'Thời điểm xuất bản';
COMMENT ON COLUMN posts.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE faq_topics IS 'Chủ đề của trang Câu hỏi thường gặp';
COMMENT ON COLUMN faq_topics.id IS 'Khóa chính';
COMMENT ON COLUMN faq_topics.key IS 'Mã chủ đề (duy nhất)';
COMMENT ON COLUMN faq_topics.label IS 'Tên chủ đề hiển thị';
COMMENT ON COLUMN faq_topics.sort_order IS 'Thứ tự hiển thị';

COMMENT ON TABLE faq_items IS 'Câu hỏi và trả lời thuộc một chủ đề FAQ';
COMMENT ON COLUMN faq_items.id IS 'Khóa chính';
COMMENT ON COLUMN faq_items.topic_id IS 'Chủ đề';
COMMENT ON COLUMN faq_items.question IS 'Câu hỏi';
COMMENT ON COLUMN faq_items.answer IS 'Câu trả lời';
COMMENT ON COLUMN faq_items.sort_order IS 'Thứ tự hiển thị';

COMMENT ON TABLE contact_messages IS 'Tin nhắn khách gửi từ trang Liên hệ';
COMMENT ON COLUMN contact_messages.id IS 'Khóa chính';
COMMENT ON COLUMN contact_messages.full_name IS 'Họ tên người gửi';
COMMENT ON COLUMN contact_messages.phone IS 'Số điện thoại';
COMMENT ON COLUMN contact_messages.email IS 'Email';
COMMENT ON COLUMN contact_messages.subject IS 'Chủ đề';
COMMENT ON COLUMN contact_messages.content IS 'Nội dung';
COMMENT ON COLUMN contact_messages.created_at IS 'Thời điểm gửi';
COMMENT ON COLUMN contact_messages.handled_at IS 'Thời điểm quản trị viên đánh dấu đã xử lý';
COMMENT ON COLUMN contact_messages.handled_by IS 'Quản trị viên đã xử lý';

-- ===== Cột mới trên bảng có sẵn =====
COMMENT ON COLUMN users.birthday IS 'Ngày sinh';
COMMENT ON COLUMN users.gender IS 'Giới tính';
COMMENT ON COLUMN users.loyalty_points IS 'Điểm tích lũy (>= 0)';
COMMENT ON COLUMN users.admin_note IS 'Ghi chú nội bộ của quản trị viên về khách hàng';
COMMENT ON COLUMN password_resets.otp_hash IS 'Mã OTP đã băm (luồng đặt lại mật khẩu bằng OTP)';
COMMENT ON COLUMN password_resets.attempts IS 'Số lần nhập sai mã';
COMMENT ON COLUMN password_resets.last_sent_at IS 'Lần gửi mã gần nhất (giới hạn gửi lại)';
COMMENT ON COLUMN addresses.label IS 'Nhãn địa chỉ, ví dụ Nhà riêng, Công ty';
COMMENT ON COLUMN categories.description IS 'Mô tả danh mục';
COMMENT ON COLUMN categories.is_featured IS 'Danh mục nổi bật ở trang chủ';
COMMENT ON COLUMN pages.type IS 'Loại trang: static (trang tĩnh) hoặc policy (chính sách)';
COMMENT ON COLUMN products.features IS 'Danh sách đặc điểm nổi bật (JSON)';
COMMENT ON COLUMN products.style IS 'Phong cách thiết kế, ví dụ Scandinavian';
COMMENT ON COLUMN attribute_values.color_hex IS 'Mã màu #RRGGBB cho giá trị thuộc tính màu';
COMMENT ON COLUMN product_variants.cost_price IS 'Giá vốn một đơn vị (VNĐ) để tính lợi nhuận';
COMMENT ON COLUMN product_variants.min_stock IS 'Ngưỡng cảnh báo tồn kho thấp';
COMMENT ON COLUMN product_variants.reserved_quantity IS 'Số lượng đang giữ chỗ cho đơn chưa giao (sẽ bỏ khi chuyển sang trừ tồn ngay khi đặt)';
COMMENT ON COLUMN product_variants.length_cm IS 'Chiều dài (cm)';
COMMENT ON COLUMN product_variants.width_cm IS 'Chiều rộng (cm)';
COMMENT ON COLUMN product_variants.height_cm IS 'Chiều cao (cm)';
COMMENT ON COLUMN reviews.is_anonymous IS 'Hiển thị ẩn danh';
COMMENT ON COLUMN reviews.tags IS 'Thẻ do khách chọn (ví dụ Chất lượng tốt)';
COMMENT ON COLUMN carts.coupon_id IS 'Mã giảm giá khách đã áp vào giỏ';
COMMENT ON COLUMN coupons.name IS 'Tên chương trình khuyến mãi';
COMMENT ON COLUMN coupons.description IS 'Mô tả chương trình';
COMMENT ON COLUMN coupons.applies_to IS 'Phạm vi áp dụng: all, category, product hoặc space';
COMMENT ON COLUMN coupons.applies_to_label IS 'Nhãn phạm vi hiển thị cho khách';
COMMENT ON COLUMN orders.internal_note IS 'Ghi chú nội bộ của quản trị viên (khách không thấy)';
COMMENT ON COLUMN order_items.cost_price IS 'Giá vốn tại thời điểm bán (VNĐ)';
COMMENT ON COLUMN order_items.image_media_id IS 'Ảnh sản phẩm chụp lại tại thời điểm mua';
COMMENT ON COLUMN order_items.variant_label IS 'Nhãn biến thể (màu, kích thước) chụp lại tại thời điểm mua';
COMMENT ON COLUMN spaces.combo_discount_percent IS 'Phần trăm giảm khi mua cả bộ sản phẩm của không gian (0-50)';
