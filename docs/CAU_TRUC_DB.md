> Cập nhật lần cuối: 2026-11-20 – theo commit `1939352`.

## DANH SÁCH BẢNG CƠ SỞ DỮ LIỆU

Hệ thống gồm 32 bảng chia thành 7 nhóm chức năng. Cột chi tiết của từng bảng: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

**Vai trò:** Quản trị viên (admin), Người dùng (user), Khách vãng lai (không cần đăng nhập, chỉ được xem; muốn thêm vào giỏ, mua hàng hay áp mã giảm giá phải đăng ký hoặc đăng nhập). Vai trò là cột `users.role` (admin hoặc user), không có bảng riêng; quyền của từng vai trò là hằng số trong mã nguồn: admin có đủ 6 quyền (quản lý người dùng, quản lý sản phẩm, xem đơn hàng, xử lý đơn hàng, quản lý nội dung, cấu hình hệ thống), user không có quyền quản trị và chỉ thao tác trên dữ liệu của chính mình.

#### 1. Người dùng và phân quyền (4 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 1 | users | Lưu tài khoản người dùng: họ tên, email (không phân biệt hoa thường), số điện thoại, mật khẩu đã mã hóa, ảnh đại diện. Có vai trò (admin hoặc user, mặc định user) và trạng thái tài khoản (hoạt động, tạm khóa, bị cấm), thời điểm xác thực email và lần đăng nhập cuối. Hỗ trợ xóa mềm. |
| 2 | password_resets | Lưu mã đặt lại mật khẩu (đã mã hóa), thời hạn hiệu lực và thời điểm sử dụng, đảm bảo mỗi mã chỉ dùng được một lần. |
| 3 | user_sessions | Quản lý phiên đăng nhập: mã làm mới phiên (refresh token), địa chỉ IP, thiết bị, thời hạn. Cho phép đăng xuất từ xa. |
| 4 | addresses | Sổ địa chỉ giao hàng của người dùng (user): tên người nhận, số điện thoại, tỉnh/thành, quận/huyện, phường/xã, số nhà. Mỗi người chỉ có một địa chỉ mặc định. |

#### 2. Hệ thống chung (4 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 5 | settings | Lưu cấu hình website: tên website, email liên hệ, đơn vị tiền tệ, phí vận chuyển mặc định… |
| 6 | media | Kho tệp tin dùng chung cho toàn hệ thống: ảnh sản phẩm, ảnh danh mục, tệp mô hình 3D, ảnh 360°. Lưu tên tệp, đường dẫn, loại tệp, dung lượng, mô tả ảnh và người tải lên. |
| 7 | notifications | Thông báo gửi đến người dùng (ví dụ: đơn hàng đã được giao). Lưu tiêu đề, dữ liệu kèm theo và trạng thái đã đọc. |
| 8 | activity_logs | Nhật ký thao tác của quản trị viên: ai thực hiện, thao tác gì, trên đối tượng nào, nội dung thay đổi, địa chỉ IP. Phục vụ kiểm tra và truy vết khi có sự cố. |

#### 3. Nội dung (1 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 9 | categories | Danh mục sản phẩm, hỗ trợ nhiều cấp (ví dụ: Nội thất → Phòng khách → Sofa). Lưu tên, đường dẫn thân thiện (slug), ảnh, thứ tự hiển thị, trạng thái bật/tắt và thông tin SEO. |

#### 4. Sản phẩm (7 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 10 | products | Thông tin chung của sản phẩm: tên, đường dẫn, mô tả ngắn, mô tả chi tiết, danh mục, thương hiệu (tên dạng chữ, có thể để trống), trạng thái, sản phẩm nổi bật. Tự động tính điểm đánh giá trung bình và số lượt đánh giá. Lưu số lượng đã bán, thông tin SEO, hỗ trợ xóa mềm. Có cờ tự động cập nhật cho biết sản phẩm có mô hình 3D hay không. Hỗ trợ tìm kiếm gần đúng theo tên. |
| 11 | attribute_values | Giá trị cụ thể của từng loại thuộc tính, ví dụ: Đỏ, Xanh, XL, Gỗ sồi. Loại thuộc tính là kiểu liệt kê attribute_code gồm 3 giá trị cố định: màu sắc (color), kích thước (size), chất liệu (material); không có bảng riêng. Mỗi cặp (loại, giá trị) là duy nhất. |
| 12 | product_variants | Biến thể cụ thể của sản phẩm dùng để bán. Mỗi biến thể có mã SKU, giá bán, giá khuyến mãi, số lượng tồn kho và cân nặng riêng. Hệ thống đảm bảo giá khuyến mãi không lớn hơn giá gốc và tồn kho không âm. |
| 13 | variant_attribute_values | Liên kết biến thể với các giá trị thuộc tính (ví dụ: biến thể SKU-001 là màu Đỏ, kích thước L). Lưu kèm loại thuộc tính (attribute_code) và đảm bảo loại khớp với giá trị; mỗi biến thể chỉ có một giá trị cho mỗi loại. |
| 14 | product_images | Ảnh sản phẩm, có thể gắn riêng cho từng biến thể. Lưu thứ tự hiển thị; mỗi sản phẩm có một ảnh đại diện duy nhất. |
| 15 | reviews | Đánh giá sản phẩm từ 1 đến 5 sao kèm nội dung. Có thể gắn với đơn hàng để chỉ người dùng đã mua mới được đánh giá. Đánh giá cần được duyệt trước khi hiển thị; khi duyệt, điểm trung bình của sản phẩm tự động cập nhật. |
| 16 | wishlists | Danh sách sản phẩm yêu thích của từng người dùng. |

#### 5. Mô hình 3D (3 bảng; phần AR đã loại bỏ)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 17 | product_3d_models | Mô hình 3D của sản phẩm hoặc của một biến thể cụ thể. Lưu kích thước thật (dài, rộng, cao theo mm) để hiển thị đúng tỉ lệ ngoài đời thực; vị trí đặt (sàn nhà, tường, mặt bàn); cho phép hoặc khóa thay đổi tỉ lệ; cấu hình trình xem 3D (góc camera, tự xoay, ánh sáng, độ sáng, ảnh chờ khi tải). Theo dõi trạng thái xử lý (đang tải lên, đang xử lý, sẵn sàng, lỗi) và phiên bản. Mỗi sản phẩm có một mô hình chính. |
| 18 | model_files | Các tệp thực tế của mô hình 3D: định dạng GLB dùng cho web và Android (giá trị USDZ của enum được giữ để không xóa dữ liệu sẵn có, hệ thống không nhận USDZ). Mỗi định dạng có thể có 3 mức chi tiết (cao, trung bình, thấp) để thiết bị cấu hình yếu tải nhanh hơn. Lưu số đa giác, độ phân giải texture, trạng thái nén và mã kiểm tra tệp. |
| 19 | model_material_variants | Cho phép đổi màu hoặc chất liệu ngay trên cùng một mô hình 3D khi người xem chọn biến thể khác, không cần tải lại mô hình mới. |

#### 6. Giỏ hàng và đơn hàng (9 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 20 | carts | Giỏ hàng của người dùng đã đăng nhập (user). Mỗi người dùng có một giỏ hàng. Khách vãng lai phải đăng ký hoặc đăng nhập mới thêm được sản phẩm vào giỏ. |
| 21 | cart_items | Danh sách sản phẩm (theo biến thể) và số lượng trong giỏ hàng. |
| 22 | coupons | Mã giảm giá theo phần trăm hoặc số tiền cố định. Lưu mức giảm tối đa, giá trị đơn hàng tối thiểu, tổng số lượt sử dụng, số lượt cho mỗi người dùng và thời gian hiệu lực. Chỉ người dùng đã đăng nhập mới được áp mã. Cột `is_public` cho biết mã công khai (hiện cho khách chọn) hay riêng tư (mặc định, khách phải tự nhập); thêm cột này không thêm bảng, hệ thống vẫn 32 bảng. |
| 23 | coupon_usages | Ghi nhận mỗi lần sử dụng mã giảm giá (người dùng nào, đơn hàng nào) để kiểm soát giới hạn lượt dùng. Chỉ người dùng đã đăng nhập mới được áp mã. |
| 24 | orders | Đơn hàng: mã đơn, trạng thái (chờ xác nhận, đã xác nhận, đang xử lý, đang giao, hoàn tất, đã hủy, hoàn tiền). Lưu thông tin người nhận tại thời điểm đặt hàng; tạm tính, giảm giá, phí vận chuyển và tổng tiền (hệ thống tự kiểm tra tổng tiền khớp); phương thức và trạng thái thanh toán; ghi chú và lý do hủy. |
| 25 | order_items | Chi tiết từng sản phẩm trong đơn hàng. Lưu lại tên sản phẩm, mã SKU và đơn giá tại thời điểm mua để đơn hàng cũ không bị ảnh hưởng khi sản phẩm thay đổi giá hoặc bị xóa. Thành tiền được tính tự động. |
| 26 | order_status_history | Lịch sử thay đổi trạng thái đơn hàng: trạng thái cũ, trạng thái mới, người thay đổi, ghi chú và thời điểm. |
| 27 | payments | Giao dịch thanh toán: phương thức (COD, chuyển khoản, MoMo, VNPay, ZaloPay, thẻ), số tiền, trạng thái, mã giao dịch từ cổng thanh toán, dữ liệu phản hồi và thời điểm thanh toán. |
| 28 | shipments | Thông tin vận chuyển: đơn vị vận chuyển (GHN, GHTK, Viettel Post…), mã vận đơn, trạng thái giao hàng, phí vận chuyển, thời điểm gửi và thời điểm nhận. |

#### 7. Không gian mẫu – Space / Panorama (4 bảng)

Luồng tổng quát: một không gian mẫu (spaces) gồm nhiều ảnh 360° (space_panoramas). Trên mỗi ảnh 360° có thể gắn các điểm bấm (space_hotspots) và đặt các mô hình 3D thật (space_product_placements).

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 29 | spaces | Lưu thông tin một không gian mẫu hoàn chỉnh, ví dụ "Phòng khách tối giản 20m²". Phân loại theo loại phòng (phòng khách, phòng ngủ, nhà bếp…) và phong cách (ví dụ Scandinavian) để người dùng lọc và duyệt. Gắn vào hệ thống danh mục chung để sắp xếp theo bộ sưu tập. Có trạng thái nháp, đã đăng, lưu trữ giống sản phẩm và trang tĩnh. Hỗ trợ tìm kiếm tiếng Việt không dấu, ví dụ gõ "phong khach" vẫn tìm ra "Phòng khách". |
| 30 | space_panoramas | Lưu các ảnh 360° của một không gian mẫu. Một không gian có thể có nhiều ảnh 360° để tạo tour tham quan nhiều góc hoặc nhiều phòng trong cùng một căn. Mỗi ảnh lưu tham chiếu tới tệp ảnh đã tải lên, cùng góc nhìn mặc định khi mở (góc ngang, góc dọc, độ rộng khung nhìn) để không gian luôn hiển thị ở góc đẹp nhất. Mỗi không gian có đúng một ảnh mở đầu tiên. |
| 31 | space_hotspots | Lưu các điểm bấm tương tác đặt tại một vị trí trên ảnh 360°. Có 3 loại điểm bấm: **sản phẩm** (bấm để mở thông tin sản phẩm, phục vụ tính năng "mua theo phong cách phòng"); **điều hướng** (bấm để chuyển sang ảnh 360° khác, dùng cho tour nhiều phòng); **thông tin** (chỉ hiện ghi chú, ví dụ mô tả vật liệu tường). Cơ sở dữ liệu tự kiểm tra dữ liệu phải khớp với từng loại, ví dụ điểm bấm loại sản phẩm bắt buộc phải có sản phẩm. |
| 32 | space_product_placements | Đặt mô hình 3D thật của sản phẩm vào ảnh 360° với đúng phối cảnh. Khác với điểm bấm chỉ là ghim 2D, bảng này lưu vị trí đặt trong ảnh, khoảng cách tới máy ảnh để tính kích thước hiển thị đúng tỉ lệ thật, góc xoay và tỉ lệ để mô hình khớp với không gian. Có thể chọn biến thể hoặc mô hình cụ thể; nếu không chọn sẽ dùng mô hình chính của sản phẩm. Cho phép người dùng thử đổi món đồ khác ngay trong phòng mẫu mà không cần thử tại nhà. |
