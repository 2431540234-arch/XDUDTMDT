## DANH SÁCH BẢNG CƠ SỞ DỮ LIỆU

Hệ thống gồm **44 bảng**, chia thành **7 nhóm** chức năng.

**Vai trò:** Quản trị viên (admin), Người dùng (user), Khách vãng lai (không cần đăng nhập, chỉ được xem; muốn thêm vào giỏ, mua hàng hay áp mã giảm giá phải đăng ký hoặc đăng nhập).

#### 1. Người dùng và phân quyền (8 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 1 | users | Lưu tài khoản người dùng: họ tên, email (không phân biệt hoa thường), số điện thoại, mật khẩu đã mã hóa, ảnh đại diện. Có trạng thái tài khoản (hoạt động, tạm khóa, bị cấm), thời điểm xác thực email và lần đăng nhập cuối. Hỗ trợ xóa mềm. |
| 2 | roles | Danh sách vai trò trong hệ thống. Có sẵn 2 vai trò: quản trị viên (admin) và người dùng (user). Khách vãng lai không có tài khoản nên không lưu trong bảng này. Khách vãng lai chỉ được xem sản phẩm, mô hình 3D/AR, không gian mẫu và trang tĩnh. Muốn thêm vào giỏ hàng, mua hàng hay áp mã giảm giá phải đăng ký hoặc đăng nhập. |
| 3 | permissions | Danh sách các quyền cụ thể: quản lý người dùng, quản lý sản phẩm, xem đơn hàng, xử lý đơn hàng, quản lý nội dung, cấu hình hệ thống. |
| 4 | role_permissions | Gán quyền cho từng vai trò. Quản trị viên (admin) có toàn bộ quyền. Người dùng (user) không có quyền quản trị, chỉ thao tác trên dữ liệu của chính mình. |
| 5 | user_roles | Gán vai trò cho người dùng. Một người dùng có thể có nhiều vai trò. |
| 6 | password_resets | Lưu mã đặt lại mật khẩu (đã mã hóa), thời hạn hiệu lực và thời điểm sử dụng, đảm bảo mỗi mã chỉ dùng được một lần. |
| 7 | user_sessions | Quản lý phiên đăng nhập: mã làm mới phiên (refresh token), địa chỉ IP, thiết bị, thời hạn. Cho phép đăng xuất từ xa. |
| 8 | addresses | Sổ địa chỉ giao hàng của người dùng (user): tên người nhận, số điện thoại, tỉnh/thành, quận/huyện, phường/xã, số nhà. Mỗi người chỉ có một địa chỉ mặc định. |

#### 2. Hệ thống chung (4 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 9 | settings | Lưu cấu hình website: tên website, email liên hệ, đơn vị tiền tệ, phí vận chuyển mặc định… |
| 10 | media | Kho tệp tin dùng chung cho toàn hệ thống: ảnh sản phẩm, ảnh danh mục, tệp mô hình 3D, ảnh chụp AR. Lưu tên tệp, đường dẫn, loại tệp, dung lượng, mô tả ảnh và người tải lên. |
| 11 | notifications | Thông báo gửi đến người dùng (ví dụ: đơn hàng đã được giao). Lưu tiêu đề, dữ liệu kèm theo và trạng thái đã đọc. |
| 12 | activity_logs | Nhật ký thao tác của quản trị viên: ai thực hiện, thao tác gì, trên đối tượng nào, nội dung thay đổi, địa chỉ IP. Phục vụ kiểm tra và truy vết khi có sự cố. |

#### 3. Nội dung (2 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 13 | categories | Danh mục sản phẩm, hỗ trợ nhiều cấp (ví dụ: Nội thất → Phòng khách → Sofa). Lưu tên, đường dẫn thân thiện (slug), ảnh, thứ tự hiển thị, trạng thái bật/tắt và thông tin SEO. |
| 14 | pages | Các trang tĩnh như Giới thiệu, Chính sách đổi trả, Hướng dẫn mua hàng. Lưu nội dung, trạng thái (nháp, đã đăng, lưu trữ) và thông tin SEO. |

#### 4. Sản phẩm (10 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 15 | brands | Thương hiệu sản phẩm: tên, đường dẫn, logo, trạng thái bật/tắt. |
| 16 | products | Thông tin chung của sản phẩm: tên, đường dẫn, mô tả ngắn, mô tả chi tiết, danh mục, thương hiệu, trạng thái, sản phẩm nổi bật. Tự động tính điểm đánh giá trung bình và số lượt đánh giá. Lưu số lượng đã bán, thông tin SEO, hỗ trợ xóa mềm. Có hai cờ tự động cập nhật cho biết sản phẩm có mô hình 3D và có hỗ trợ AR hay không. Hỗ trợ tìm kiếm gần đúng theo tên. |
| 17 | attributes | Các loại thuộc tính sản phẩm như Màu sắc, Kích thước, Chất liệu. |
| 18 | attribute_values | Giá trị cụ thể của từng thuộc tính, ví dụ: Đỏ, Xanh, XL, Gỗ sồi. |
| 19 | product_variants | Biến thể cụ thể của sản phẩm dùng để bán. Mỗi biến thể có mã SKU, giá bán, giá khuyến mãi, số lượng tồn kho và cân nặng riêng. Hệ thống đảm bảo giá khuyến mãi không lớn hơn giá gốc và tồn kho không âm. |
| 20 | variant_attribute_values | Liên kết biến thể với các giá trị thuộc tính (ví dụ: biến thể SKU-001 là màu Đỏ, kích thước L). |
| 21 | product_images | Ảnh sản phẩm, có thể gắn riêng cho từng biến thể. Lưu thứ tự hiển thị; mỗi sản phẩm có một ảnh đại diện duy nhất. |
| 22 | inventory_movements | Lịch sử biến động tồn kho: nhập hàng, xuất bán, trả hàng, điều chỉnh. Lưu số lượng thay đổi, lý do, mã chứng từ liên quan và người thực hiện. |
| 23 | reviews | Đánh giá sản phẩm từ 1 đến 5 sao kèm nội dung. Có thể gắn với đơn hàng để chỉ người dùng đã mua mới được đánh giá. Đánh giá cần được duyệt trước khi hiển thị; khi duyệt, điểm trung bình của sản phẩm tự động cập nhật. |
| 24 | wishlists | Danh sách sản phẩm yêu thích của từng người dùng. |

#### 5. Mô hình 3D và thực tế tăng cường AR (5 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 25 | product_3d_models | Mô hình 3D của sản phẩm hoặc của một biến thể cụ thể. Lưu kích thước thật (dài, rộng, cao theo mm) để AR hiển thị đúng tỉ lệ ngoài đời thực; vị trí đặt trong AR (sàn nhà, tường, mặt bàn); cho phép hoặc khóa thay đổi tỉ lệ; cấu hình trình xem 3D (góc camera, tự xoay, ánh sáng, độ sáng, ảnh chờ khi tải). Theo dõi trạng thái xử lý (đang tải lên, đang xử lý, sẵn sàng, lỗi) và phiên bản. Mỗi sản phẩm có một mô hình chính. |
| 26 | model_files | Các tệp thực tế của mô hình 3D: định dạng GLB dùng cho web và Android, định dạng USDZ dùng cho iPhone. Mỗi định dạng có thể có 3 mức chi tiết (cao, trung bình, thấp) để thiết bị cấu hình yếu tải nhanh hơn. Lưu số đa giác, độ phân giải texture, trạng thái nén và mã kiểm tra tệp. |
| 27 | model_material_variants | Cho phép đổi màu hoặc chất liệu ngay trên cùng một mô hình 3D khi người xem chọn biến thể khác, không cần tải lại mô hình mới. |
| 28 | ar_sessions | Thống kê mỗi lượt xem 3D hoặc AR (của cả người dùng và khách vãng lai): thiết bị, hệ điều hành, nền tảng AR, thời gian xem, có đặt được sản phẩm vào không gian hay không, có chụp ảnh hay không và có thêm sản phẩm vào giỏ hàng sau đó hay không. Dùng để đánh giá hiệu quả của tính năng AR. |
| 29 | ar_snapshots | Ảnh người dùng (đã đăng nhập) chụp khi đặt sản phẩm vào không gian thật bằng AR. Người dùng có thể chọn công khai để hiển thị trong mục "Khách hàng đã trải nghiệm". |

#### 6. Giỏ hàng và đơn hàng (9 bảng)

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 30 | carts | Giỏ hàng của người dùng đã đăng nhập (user). Mỗi người dùng có một giỏ hàng. Khách vãng lai phải đăng ký hoặc đăng nhập mới thêm được sản phẩm vào giỏ. |
| 31 | cart_items | Danh sách sản phẩm (theo biến thể) và số lượng trong giỏ hàng. |
| 32 | coupons | Mã giảm giá theo phần trăm hoặc số tiền cố định. Lưu mức giảm tối đa, giá trị đơn hàng tối thiểu, tổng số lượt sử dụng, số lượt cho mỗi người dùng và thời gian hiệu lực. Chỉ người dùng đã đăng nhập mới được áp mã. |
| 33 | coupon_usages | Ghi nhận mỗi lần sử dụng mã giảm giá (người dùng nào, đơn hàng nào) để kiểm soát giới hạn lượt dùng. Chỉ người dùng đã đăng nhập mới được áp mã. |
| 34 | orders | Đơn hàng: mã đơn, trạng thái (chờ xác nhận, đã xác nhận, đang xử lý, đang giao, hoàn tất, đã hủy, hoàn tiền). Lưu thông tin người nhận tại thời điểm đặt hàng; tạm tính, giảm giá, phí vận chuyển và tổng tiền (hệ thống tự kiểm tra tổng tiền khớp); phương thức và trạng thái thanh toán; ghi chú và lý do hủy. |
| 35 | order_items | Chi tiết từng sản phẩm trong đơn hàng. Lưu lại tên sản phẩm, mã SKU và đơn giá tại thời điểm mua để đơn hàng cũ không bị ảnh hưởng khi sản phẩm thay đổi giá hoặc bị xóa. Thành tiền được tính tự động. |
| 36 | order_status_history | Lịch sử thay đổi trạng thái đơn hàng: trạng thái cũ, trạng thái mới, người thay đổi, ghi chú và thời điểm. |
| 37 | payments | Giao dịch thanh toán: phương thức (COD, chuyển khoản, MoMo, VNPay, ZaloPay, thẻ), số tiền, trạng thái, mã giao dịch từ cổng thanh toán, dữ liệu phản hồi và thời điểm thanh toán. |
| 38 | shipments | Thông tin vận chuyển: đơn vị vận chuyển (GHN, GHTK, Viettel Post…), mã vận đơn, trạng thái giao hàng, phí vận chuyển, thời điểm gửi và thời điểm nhận. |

#### 7. Không gian mẫu – Space / Panorama (6 bảng)

Luồng tổng quát: một không gian mẫu (spaces) gồm nhiều ảnh 360° (space_panoramas). Trên mỗi ảnh 360° có thể gắn các điểm bấm (space_hotspots) và đặt các mô hình 3D thật (space_product_placements). Người dùng có thể lưu lại không gian yêu thích (space_bookmarks), và mọi lượt xem đều được ghi nhận (space_views).

| STT | Tên bảng | Chức năng |
| --- | --- | --- |
| 39 | spaces | Lưu thông tin một không gian mẫu hoàn chỉnh, ví dụ "Phòng khách tối giản 20m²". Phân loại theo loại phòng (phòng khách, phòng ngủ, nhà bếp…) và phong cách (ví dụ Scandinavian) để người dùng lọc và duyệt. Gắn vào hệ thống danh mục chung để sắp xếp theo bộ sưu tập. Có trạng thái nháp, đã đăng, lưu trữ giống sản phẩm và trang tĩnh. Có bộ đếm lượt xem tự động tăng mỗi khi có lượt xem mới. Hỗ trợ tìm kiếm tiếng Việt không dấu, ví dụ gõ "phong khach" vẫn tìm ra "Phòng khách". |
| 40 | space_panoramas | Lưu các ảnh 360° của một không gian mẫu. Một không gian có thể có nhiều ảnh 360° để tạo tour tham quan nhiều góc hoặc nhiều phòng trong cùng một căn. Mỗi ảnh lưu tham chiếu tới tệp ảnh đã tải lên, cùng góc nhìn mặc định khi mở (góc ngang, góc dọc, độ rộng khung nhìn) để không gian luôn hiển thị ở góc đẹp nhất. Mỗi không gian có đúng một ảnh mở đầu tiên. |
| 41 | space_hotspots | Lưu các điểm bấm tương tác đặt tại một vị trí trên ảnh 360°. Có 3 loại điểm bấm: **sản phẩm** (bấm để mở thông tin sản phẩm, phục vụ tính năng "mua theo phong cách phòng"); **điều hướng** (bấm để chuyển sang ảnh 360° khác, dùng cho tour nhiều phòng); **thông tin** (chỉ hiện ghi chú, ví dụ mô tả vật liệu tường). Cơ sở dữ liệu tự kiểm tra dữ liệu phải khớp với từng loại, ví dụ điểm bấm loại sản phẩm bắt buộc phải có sản phẩm. |
| 42 | space_product_placements | Đặt mô hình 3D thật của sản phẩm vào ảnh 360° với đúng phối cảnh. Khác với điểm bấm chỉ là ghim 2D, bảng này lưu vị trí đặt trong ảnh, khoảng cách tới máy ảnh để tính kích thước hiển thị đúng tỉ lệ thật, góc xoay và tỉ lệ để mô hình khớp với không gian. Có thể chọn biến thể hoặc mô hình cụ thể; nếu không chọn sẽ dùng mô hình chính của sản phẩm. Cho phép người dùng thử đổi món đồ khác ngay trong phòng mẫu mà không cần dùng AR tại nhà. |
| 43 | space_bookmarks | Lưu danh sách không gian mẫu yêu thích của từng người dùng để xem lại sau, tương tự danh sách sản phẩm yêu thích. |
| 44 | space_views | Ghi nhận mỗi lượt xem không gian mẫu để đo hiệu quả. Lưu sản phẩm mà người dùng đã đi từ đó vào không gian mẫu (để biết sản phẩm nào dẫn lượt truy cập tới phòng mẫu), số lần bấm điểm tương tác và có thêm sản phẩm vào giỏ hay không. Dùng để đo hành trình xem phòng → bấm điểm tương tác → thêm vào giỏ, từ đó đánh giá phòng mẫu nào bán hàng tốt. Mỗi lượt xem mới sẽ tự động tăng bộ đếm lượt xem của không gian tương ứng. |