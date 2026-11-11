> **Đã lưu trữ ngày 2026-11-11 – lý do: lệnh giao việc cho agent ở giai đoạn dựng frontend, không mô tả hệ thống hiện tại.** Nội dung bên dưới được giữ nguyên, không còn phản ánh hiện trạng.

# PROMPT CHO AGENT — Phân tích dự án & dựng Frontend theo Wireframe (Aurelia Living)

> Cách dùng: copy toàn bộ phần bên dưới đường kẻ `=====` và dán vào agent (Copilot Agent / Claude Code / Cursor / Cline…) đang mở thư mục gốc của dự án.
> Nếu agent bị hết ngữ cảnh giữa chừng, mở phiên mới và gõ: **"Đọc docs/FE_PROGRESS.md và tiếp tục từ bước đang dở theo docs/PROMPT_AGENT_FE.md"**.

=====

## VAI TRÒ
Bạn là Senior Full-stack Engineer kiêm Frontend Lead của đồ án **"Xây dựng ứng dụng thương mại điện tử – Aurelia Living"** (website nội thất có xem sản phẩm 3D/AR và bộ sưu tập Không gian mẫu). Nhiệm vụ của bạn gồm 3 việc theo đúng thứ tự:
1. **Quét và hiểu chính xác toàn bộ dự án**: Database → Backend → Frontend → tài liệu trong `docs/`.
2. **Dựng giao diện Frontend** đúng theo wireframe đã mô tả trong `docs/`.
3. **Tạo thư mục `mock-data/`** chứa đầy đủ dữ liệu giả + lớp mock API để tôi chạy và kiểm tra toàn bộ giao diện trên trình duyệt mà **không cần backend**.

**Hệ thống chỉ có 2 vai trò: Doanh nghiệp (admin – quản trị cửa hàng) và Khách hàng. KHÔNG có nhân viên, KHÔNG làm phân quyền nhiều cấp/ma trận quyền.** Nếu trong code hoặc tài liệu cũ có dấu vết role nhân viên thì ghi vào báo cáo, không dựng giao diện cho nó.

Làm việc cẩn thận, chính xác, không đoán. Mọi khẳng định trong báo cáo phải chỉ ra được file nguồn (đường dẫn + tên bảng/hàm/route).

---

## QUY TẮC BẮT BUỘC
1. **Không xoá, không ghi đè, không đổi tên** file sẵn có của Backend và Database. Không chạy migration, không động vào database thật, không sửa file `.env` thật (chỉ được tạo `.env.example` / `.env.development.local` cho FE).
2. Frontend: được thêm file mới; chỉ được sửa file sẵn có khi cần để gắn route, layout hoặc cấu hình. Mỗi lần sửa file cũ phải ghi lý do vào `docs/FE_PROGRESS.md`.
3. **Dùng lại stack hiện có** (framework, router, thư viện UI, cách viết CSS, quản lý state, HTTP client). Chỉ cài thêm thư viện khi thật sự cần (ví dụ viewer 3D/360°, biểu đồ, mock API). Mỗi thư viện thêm vào phải ghi tên, lý do và phiên bản.
4. Nếu dự án là Git repo: tạo nhánh mới `feature/fe-wireframe-mock` trước khi sửa. Commit theo từng giai đoạn, message rõ ràng.
5. Toàn bộ chữ trên giao diện viết **tiếng Việt có dấu**. Tiền tệ định dạng `8.500.000đ`, ngày `dd/MM/yyyy`.
6. **Tên trường dữ liệu trong mock phải khớp 100% với Database/Backend** (cùng kiểu chữ camelCase/snake_case, cùng tên bảng/khoá, cùng kiểu dữ liệu, cùng enum trạng thái). Wireframe chỉ quyết định *giao diện*; *cấu trúc dữ liệu* lấy theo DB/BE. Chỗ nào wireframe cần dữ liệu mà DB chưa có thì ghi vào mục "Thiếu sót" và tạm đặt tên trường theo mục 5 của `WIREFRAME.md`, đánh dấu `// TODO: chưa có trong DB`.
7. Chỉ dừng lại hỏi tôi khi gặp **vấn đề chặn** (ví dụ: không xác định được framework FE, có 2 FE song song, DB và BE mâu thuẫn nghiêm trọng). Các trường hợp còn lại: tự chọn phương án hợp lý nhất, ghi rõ giả định vào báo cáo rồi làm tiếp.
8. Sau mỗi giai đoạn, cập nhật `docs/FE_PROGRESS.md` (đã làm gì, file nào, còn gì, lỗi gì) để có thể tiếp tục ở phiên sau.

---

## GIAI ĐOẠN 1 — ĐỌC TÀI LIỆU TRONG `docs/`
1. Liệt kê **mọi file** trong `docs/` (kể cả thư mục con) và đọc hết từng file, không bỏ sót.
2. Đọc **`docs/WIREFRAME.md` từ đầu đến cuối**. Đây là đặc tả giao diện chính, gồm 54 màn hình:
   - Mục 0: design tokens và màu badge trạng thái.
   - Mục 1: component dùng chung.
   - Mục 2: 14 màn hình storefront gốc.
   - Mục 3: 10 màn hình admin (doanh nghiệp) gốc.
   - Mục 4: routes.
   - Mục 5: thực thể dữ liệu.
   - Mục 6: ghi chú code.
   - Mục 7: 28 màn hình bổ sung (7A storefront, 7B admin, 7C luồng liên kết).
3. Nếu có thư mục ảnh `docs/wireframes/` thì **mở xem từng ảnh** đối chiếu với mô tả. Nếu có `docs/mockups-html/` thì đọc mã HTML/CSS để lấy chính xác khoảng cách, cỡ chữ, bo góc, màu. Nếu thiếu 2 thư mục này thì làm theo mô tả chữ trong `WIREFRAME.md` và ghi chú lại.
4. Đọc các tài liệu khác (đặc tả yêu cầu, use case, ERD, API spec, README…) nếu có. Khi tài liệu mâu thuẫn nhau thì ghi lại; ưu tiên: **DB/BE thực tế > API spec > WIREFRAME.md** cho dữ liệu, còn **WIREFRAME.md** cho giao diện.

## GIAI ĐOẠN 2 — QUÉT DATABASE
Tìm mọi nguồn định nghĩa dữ liệu: file `.sql`, migrations, seeders, schema ORM (Prisma `schema.prisma`, Sequelize/TypeORM/Mongoose models, Entity Framework, JPA Entity, Laravel migrations, Django models…), file backup DB, sơ đồ ERD.
Với **từng bảng/collection**, ghi lại:
- Tên bảng, từng cột: tên, kiểu, null/not null, mặc định, unique, enum.
- Khoá chính, khoá ngoại, quan hệ (1-1, 1-n, n-n qua bảng trung gian), index.
- Giá trị enum/trạng thái thực tế (trạng thái đơn hàng, thanh toán, đổi trả, coupon, role người dùng – kỳ vọng chỉ có doanh nghiệp/khách hàng…).
- Dữ liệu seed hiện có (nếu có) để mock data dùng cùng phong cách.

Vẽ **ERD bằng Mermaid** (`erDiagram`).

## GIAI ĐOẠN 3 — QUÉT BACKEND
Xác định và ghi lại:
- Ngôn ngữ, framework, phiên bản, cách chạy, port, biến môi trường cần có (chỉ ghi tên biến, **không ghi giá trị bí mật**).
- Cấu trúc thư mục (cây thư mục 3–4 cấp) và vai trò từng lớp: routes → controllers → services → repositories/models, middleware.
- **Bảng đầy đủ mọi API endpoint**: Method · URL · Auth/role yêu cầu · Query/Body · Response mẫu · File định nghĩa.
- Định dạng response chung: envelope (`{ success, data, message }`…), cách phân trang (page/limit/total…), định dạng lỗi, mã HTTP.
- Xác thực: JWT/session/cookie, nơi lưu token, refresh token, phân biệt 2 role doanh nghiệp (admin) / khách hàng, đăng nhập Google, OTP quên mật khẩu.
- Upload file (ảnh, GLB/USDZ), tích hợp thanh toán (VNPAY/MoMo/ZaloPay), gửi email.
- Đánh dấu endpoint nào **đã có**, **làm dở**, hay **chưa có** so với nhu cầu của 54 màn hình.

## GIAI ĐOẠN 4 — QUÉT FRONTEND
Xác định và ghi lại:
- Framework và phiên bản (React/Vite, Next.js, Vue/Nuxt, Angular…), TypeScript hay JavaScript, công cụ build, lệnh `dev`/`build`/`lint`.
- Router và danh sách route hiện có; layout; route guard.
- Quản lý state (Redux/Zustand/Pinia/Context…), data fetching (axios/fetch/React Query/SWR), file cấu hình HTTP client, baseURL, interceptor.
- Thư viện UI và cách viết CSS (Tailwind/SCSS/CSS Modules/MUI/AntD/shadcn…), font, icon.
- Cây thư mục `src/` và quy ước đặt tên.
- Component/trang đã có, mức độ hoàn thiện, chỗ nào trùng với wireframe.

## GIAI ĐOẠN 5 — VIẾT BÁO CÁO PHÂN TÍCH
Tạo file **`docs/PROJECT_ANALYSIS.md`** gồm:
1. Tóm tắt stack (bảng).
2. Cây thư mục DB / BE / FE.
3. ERD Mermaid + mô tả từng bảng.
4. Bảng API endpoint.
5. **Ma trận ánh xạ 54 màn hình**: `# | Màn hình (theo WIREFRAME.md) | Route FE | Component/Page file | API dùng | Bảng DB | Trạng thái (Đã có / Cần làm / Thiếu API / Thiếu bảng)`.
6. **Thiếu sót & mâu thuẫn**: trường/bảng mà wireframe cần nhưng DB chưa có, API còn thiếu, tên trường lệch giữa DB–BE–tài liệu, enum không khớp.
7. Danh sách giả định đã chọn.
8. Kế hoạch dựng FE (thứ tự làm, file sẽ tạo).

Viết xong báo cáo thì **tiếp tục sang giai đoạn 6**, không cần chờ tôi duyệt, trừ khi có vấn đề chặn.

## GIAI ĐOẠN 6 — NỀN TẢNG GIAO DIỆN (DESIGN SYSTEM)
1. Khai báo design tokens theo mục **0.1 WIREFRAME.md** (màu primary `#8B4A2B`, nền `#FAF6F2`, surface, muted, text, border, star, danger, bo góc, font Inter/Be Vietnam Pro), viết theo cách của dự án (Tailwind config / CSS variables / theme của thư viện UI).
2. Tạo các tiện ích: `formatCurrency` (VNĐ), `formatDate`, `formatRelativeTime` ("5 phút trước"), map trạng thái → màu badge theo mục 0.2.
3. Tạo component dùng chung theo mục 1 và mục 6 WIREFRAME.md, tối thiểu gồm:
   - Storefront: `Header` (2 trạng thái đăng nhập/chưa, badge giỏ và yêu thích, dropdown thông báo), `Footer`, `Breadcrumb`, `ProductCard`, `FilterSidebar`, `SortToolbar` (Grid/List), `Pagination`, `StatusBadge`, `StarRating`, `ColorSwatch`, `QuantityStepper`, `AccountSidebar` (10 mục theo mục 1.7 bản đầy đủ), `CouponCard`, `OrderCard`, `ReviewCard`, `OrderStepper`, `Modal`, `EmptyState`, `Skeleton`.
   - Admin: `AdminLayout`, `AdminSidebar` (15 mục, bản chuẩn hoá ở mục 3.0), `AdminTopbar`, `DataTable` (checkbox, sắp xếp, phân trang, cột thao tác ⋯), `KpiCard`, `FilterBar`, `FormSection` với tab dọc, `UploadDropzone`, `ChartCard`.
4. Layout: `StoreLayout`, `AuthLayout` (2 cột ảnh + form), `AccountLayout`, `AdminLayout`.

## GIAI ĐOẠN 7 — THƯ MỤC `mock-data/` VÀ MOCK API
### 7.1 Vị trí và cấu trúc
- Đặt thư mục **`mock-data/`** bên trong project FE, ở chỗ bundler import được (ví dụ `src/mock-data/` hoặc `<fe-root>/mock-data/` có alias). Ghi rõ đường dẫn đã chọn.
- Mỗi bảng DB một file (`.json` hoặc `.ts`/`.js` export mảng, tên file trùng tên bảng), cộng thêm:
  - `index` gom tất cả.
  - `README.md` mô tả từng file và tài khoản test.
  - `mockApi/` (hoặc `handlers/`) chứa lớp giả lập API.
  - `assets/` hoặc `public/mock/` chứa ảnh minh hoạ và file 3D mẫu.

### 7.2 Dữ liệu cần có (tối thiểu)
| Nhóm | Số lượng & yêu cầu |
|---|---|
| Người dùng | 1 tài khoản **doanh nghiệp** (admin) + 30+ **khách hàng** (2 nhóm: mới / thân thiết; có tài khoản bị khoá). Không tạo nhân viên |
| Địa chỉ | 1–3 địa chỉ/khách, đúng 1 địa chỉ mặc định |
| Danh mục | Cây 2 cấp (Phòng khách, Phòng ngủ, Phòng ăn, Phòng làm việc, Đèn & trang trí → Sofa, Bàn trà, Kệ tivi, Giường, Tủ…) |
| Sản phẩm | 48+ sản phẩm phủ mọi danh mục; có giá gốc/giá sale/% giảm, tồn kho (có SP hết hàng, sắp hết), chất liệu, phong cách, mô tả dài, thông số kỹ thuật, 4–5 ảnh, rating và số đánh giá khớp với bảng reviews |
| Biến thể | Màu (tên + mã hex) × kích thước (2/3/4 chỗ…), tồn kho riêng |
| Mô hình 3D | 20+ bản ghi GLB/USDZ gắn với sản phẩm; có ít nhất 1 file `.glb` mẫu dùng được thật (ví dụ model mẫu bản quyền mở của Khronos glTF-Sample-Assets) để viewer chạy |
| Không gian mẫu | 12+ không gian (6 phong cách × 4 loại phòng), ảnh 360°, hotspot (pitch/yaw → productId), danh sách sản phẩm gợi ý, giá combo |
| Giỏ hàng, yêu thích | Cho tài khoản test |
| Đơn hàng | 60+ đơn trải đều tháng 01–11/2026, **đủ mọi trạng thái** (chờ xác nhận, đang xử lý, đang giao, đã giao, đã huỷ) và mọi trạng thái thanh toán / phương thức (COD, thẻ, VNPAY, MoMo, ZaloPay); có lịch sử trạng thái; tạm tính − giảm giá + phí ship = tổng **tính đúng** |
| Đánh giá | 80+ (1–5 sao, có ảnh, có cái bị ẩn), chỉ gắn với đơn đã giao |
| Hỏi đáp | 30+ (đã trả lời / chưa trả lời / ẩn) |
| Khuyến mãi / coupon | 12+ (giảm %, giảm tiền, freeship; đang diễn ra / sắp diễn ra / đã kết thúc) + coupon của từng khách (chưa dùng / đã dùng / hết hạn) |
| Đổi trả | 12+ yêu cầu đủ trạng thái |
| Thông báo | 15+ cho tài khoản test (đã đọc / chưa đọc, 3 loại) |
| Nội dung | Banner (đang hiện / đã lên lịch / ẩn), 6+ bài viết, trang tĩnh (về chúng tôi, 6 chính sách, FAQ theo chủ đề) |
| Kho | Nhà cung cấp, phiếu nhập/xuất, giá vốn, mức tồn tối thiểu |
| Thu chi | Phiếu chi theo danh mục (giá vốn, vận chuyển, marketing, phí thanh toán, hoàn tiền, khác) để báo cáo thu chi có số liệu |
| Cài đặt | Thông tin cửa hàng, cổng thanh toán, bảng phí vận chuyển theo khu vực |
| Nhật ký hoạt động | 20+ dòng cho dashboard (khách hàng đặt hàng, đánh giá, đăng ký… và thao tác của admin) |

**Yêu cầu chất lượng dữ liệu:**
- Tên người, địa chỉ, tên sản phẩm, nội dung đánh giá bằng tiếng Việt tự nhiên, không dùng "Lorem ipsum".
- Giá là số nguyên VNĐ.
- Ngày là ISO string trong năm 2026.
- **Toàn vẹn tham chiếu**: mọi khoá ngoại phải trỏ tới bản ghi có thật.
- Các số tổng hợp (doanh thu, số đơn theo trạng thái, top bán chạy, KPI dashboard, báo cáo thu chi) phải **tính ra từ dữ liệu**, không gõ cứng.
- Ảnh: dùng ảnh trong `public/mock/` hoặc ảnh minh hoạ SVG tự tạo theo loại đồ (sofa, bàn, ghế, giường, tủ, đèn), tông kem–nâu. Không để ảnh vỡ link.

**Tài khoản test** (ghi vào `mock-data/README.md` và README dự án):
- `khachhang@aurelia.vn` / `123456` (khách hàng có sẵn giỏ hàng, đơn hàng, coupon, thông báo).
- `admin@aurelia.vn` / `admin123` (tài khoản doanh nghiệp – vào Admin Panel).
- OTP quên mật khẩu giả lập luôn là `123456`.

### 7.3 Mock API
- Tạo lớp service/API cho FE với **cùng URL, method, tham số và định dạng response như Backend thật** (theo bảng endpoint ở giai đoạn 3). Endpoint mà BE chưa có thì tự đặt theo quy ước REST của dự án và ghi vào báo cáo.
- Bật/tắt bằng biến môi trường, ví dụ `VITE_USE_MOCK=true` / `NEXT_PUBLIC_USE_MOCK=true`. Khi `false` thì gọi API thật mà **không phải sửa code giao diện**. Chọn cách phù hợp với stack, ưu tiên theo thứ tự:
  1. MSW (Mock Service Worker) chặn request.
  2. Adapter trong HTTP client.
  3. Service layer có 2 bản cài đặt.
- Mock API phải hỗ trợ:
  - Phân trang, tìm kiếm, lọc (danh mục, giá, màu, chất liệu, phong cách, trạng thái, khoảng ngày), sắp xếp.
  - CRUD cho mọi trang admin.
  - Đăng nhập/đăng xuất/đăng ký/quên mật khẩu.
  - Giỏ hàng, áp mã giảm giá (kiểm tra điều kiện đơn tối thiểu, hạn dùng, phạm vi áp dụng).
  - Đặt hàng, sinh mã đơn tăng dần; chuyển trạng thái đơn; đổi trả; đánh giá; hỏi đáp; đánh dấu thông báo đã đọc.
  - Phân quyền 2 role: khách hàng không vào được `/admin`; tài khoản doanh nghiệp truy cập toàn bộ Admin Panel.
  - Giả lập độ trễ 200–500ms và có thể bật giả lập lỗi để thử trạng thái lỗi.
- Dữ liệu thay đổi được **lưu vào localStorage**. Có hàm/nút **"Khôi phục dữ liệu mẫu"** (ví dụ ở trang Cài đặt admin hoặc dùng `?resetMock=1`).

## GIAI ĐOẠN 8 — DỰNG CÁC TRANG THEO WIREFRAME
Dựng **đủ 54 màn hình** đúng bố cục, thứ tự section, nhãn chữ, trường form, cột bảng, tab, nút như mô tả trong `WIREFRAME.md` và ảnh. Mọi trang lấy dữ liệu qua lớp service ở 7.3, **không import thẳng JSON trong component**.

Thứ tự làm:
1. Layout + Header/Footer + Trang chủ (2.1) → Danh sách sản phẩm (2.2) → Chi tiết sản phẩm (2.3) → Tìm kiếm (2.13) → Không gian mẫu (2.14) → Chi tiết không gian mẫu (7.6) → Trình xem 3D/AR (7.7).
2. Giỏ hàng (2.4) → Giỏ trống (7.15) → Thanh toán (2.5) → Đặt hàng thành công/thất bại (7.2).
3. Đăng nhập, Đăng ký (2.6, 2.7) → Quên / đặt lại mật khẩu (7.3, 7.4).
4. Tài khoản:
   - Thông tin cá nhân + địa chỉ (2.8), Đổi mật khẩu (7.5).
   - Đơn hàng (2.10), Chi tiết đơn (7.1), Đổi trả (7.9).
   - Coupon (2.9), Đánh giá (2.11) + modal viết/sửa đánh giá (7.8).
   - Yêu thích (2.12), Thông báo (7.10).
5. Trang tĩnh: Về chúng tôi, Liên hệ, FAQ, Chính sách (7.11–7.14), 404 (7.16).
6. Admin:
   - Đăng nhập (7.17), Tổng quan (3.1).
   - Sản phẩm danh sách + thêm/sửa với 6 tab (3.2).
   - Không gian mẫu + thêm/sửa với 5 tab (3.3).
   - Danh mục cây + modal (3.4, 7.21).
   - Đơn hàng + chi tiết (3.5, 7.18), Đổi trả (7.19).
   - Khách hàng + chi tiết (3.6, 7.20), Đánh giá (3.7), Hỏi đáp (7.24).
   - Mô hình 3D + modal tải lên (3.8, 7.23), Khuyến mãi + tạo mới (3.9, 7.22).
   - Kho hàng (7.27), Báo cáo thu chi đầy đủ (7.28, thay cho 3.10), Nội dung (7.25), Cài đặt (7.26).

Yêu cầu cho mọi trang:
- Đủ các trạng thái: **đang tải** (skeleton), **rỗng** (EmptyState), **lỗi** (có nút thử lại), **thành công** (toast).
- Validate form có thông báo lỗi tiếng Việt (email, số điện thoại VN 10 số, mật khẩu ≥ 8 ký tự, trường bắt buộc).
- Route guard: trang tài khoản yêu cầu đăng nhập (khách hàng); toàn bộ `/admin/*` yêu cầu role **doanh nghiệp**, khách hàng truy cập sẽ bị chuyển về trang chủ hoặc trang đăng nhập quản trị.
- Responsive:
  - Desktop 1440px: lưới 4 cột.
  - Tablet: 2 cột.
  - Mobile: 1–2 cột; FilterSidebar thành drawer; AdminSidebar thu gọn bằng ☰.
- Nối đúng luồng theo **mục 7C**: các nút "Xem chi tiết", "Đánh giá sản phẩm", "Yêu cầu đổi trả", "Quên mật khẩu?", ô "3D", hotspot, icon chuông, icon giỏ…
- 3D/360°: dùng `<model-viewer>` (hoặc three.js / react-three-fiber nếu dự án đã có) cho GLB/USDZ; Pannellum hoặc Photo Sphere Viewer cho ảnh 360° có hotspot.
- Biểu đồ dashboard/báo cáo: dùng thư viện chart sẵn có của dự án, nếu chưa có thì dùng Recharts hoặc Chart.js tuỳ framework.
- Đặt tên file/thư mục theo quy ước hiện có của dự án.

## GIAI ĐOẠN 9 — KIỂM TRA & BÀN GIAO
1. Chạy `lint`, `type-check` (nếu có), `build` → sửa hết lỗi.
2. Chạy dev server với mock bật, **mở lần lượt từng route trong ma trận 54 màn hình**, kiểm tra không lỗi console, không ảnh vỡ, dữ liệu hiển thị đúng. Thử các luồng chính:
   - Khách: đăng nhập → thêm giỏ → áp mã → đặt hàng → xem chi tiết đơn → đánh giá → yêu cầu đổi trả.
   - Admin: duyệt đơn → chuyển trạng thái → duyệt đổi trả → xem báo cáo thay đổi theo.
   - Phân quyền: đăng nhập bằng tài khoản khách hàng rồi vào `/admin` → bị chặn.
3. So sánh từng trang với ảnh wireframe tương ứng. Ghi các điểm còn lệch.
4. Cập nhật **`docs/FE_PROGRESS.md`**: bảng 54 màn hình (Route · File · Trạng thái ✅/🟡/❌ · Ghi chú lệch so với wireframe), thư viện đã thêm, file cũ đã sửa, việc còn tồn đọng.
5. Thêm vào README (hoặc `mock-data/README.md`) mục **"Chạy giao diện với dữ liệu giả"**: lệnh cài đặt, cách bật/tắt mock, URL các trang chính, tài khoản test, cách khôi phục dữ liệu mẫu.
6. Kết thúc bằng một bản tóm tắt ngắn: đã làm gì, mở trang nào để kiểm tra trước, còn gì chưa xong, cần tôi quyết định gì.

=====
