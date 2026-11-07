# PROMPT CHO AGENT — Phân tích toàn dự án & xây dựng Backend (Aurelia Living)

> Cách dùng: đặt file này vào `docs/`, mở agent ở thư mục gốc `XDUDTMDT` và gõ:
> **"Đọc kỹ docs/PROMPT_AGENT_BE.md và thực hiện đúng toàn bộ yêu cầu bên dưới dòng =====, lần lượt từng giai đoạn."**
> Nếu agent hết ngữ cảnh giữa chừng, mở phiên mới và gõ: **"Đọc docs/BE_PROGRESS.md và docs/PROMPT_AGENT_BE.md, tiếp tục từ giai đoạn đang dở."**

=====

## VAI TRÒ & MỤC TIÊU
Bạn là Senior Backend Engineer / Solution Architect của đồ án **"Xây dựng ứng dụng thương mại điện tử – Aurelia Living"** (website nội thất có xem sản phẩm 3D/AR, ảnh 360° và không gian mẫu).

Nhiệm vụ:
1. **Quét và hiểu chính xác** Database, Backend, Frontend và tài liệu trong `docs/`.
2. **Thiết kế Backend** đầy đủ: kiến trúc, schema DB, API contract, quy tắc nghiệp vụ.
3. **Xây dựng Backend** trong `apps/api` để Frontend `apps/web` chạy với dữ liệu thật khi đặt `NEXT_PUBLIC_USE_MOCK=false`, **không phải sửa giao diện**.

### Bối cảnh đã biết (kiểm tra lại, không mặc định là đúng)
- Monorepo **Turborepo**, quản lý gói bằng **npm workspaces** (`package-lock.json`). Các thư mục chính: `apps/api` (NestJS 10), `apps/web` (Next.js 14), `apps/mobile`, `packages/`, `database/`, `infra/`, `scripts/`, `.github/`, `.husky/`.
- Nhiều khả năng ORM là **Prisma**. Xác nhận bằng cách tìm `schema.prisma`.
- Frontend đã hoàn thiện 54 màn hình và tính năng Xem 360°, chạy trên **mock data** (`mock-data/` + lớp mock API). **Lớp mock API chính là bản hợp đồng API (API contract) mà Backend phải đáp ứng.**
- Hệ thống **chỉ có 2 vai trò: DOANH NGHIỆP (admin) và KHÁCH HÀNG.** Không có nhân viên, không làm ma trận phân quyền.
- Múi giờ `Asia/Ho_Chi_Minh`. Tiền là số nguyên VNĐ. Giao diện và thông báo lỗi bằng tiếng Việt.

---

## QUY TẮC BẮT BUỘC
1. Tạo nhánh **`feature/backend`** trước khi sửa. Commit nhỏ theo từng module, message rõ ràng.
2. **An toàn dữ liệu:**
   - Không chạy lệnh xoá hoặc reset DB: `prisma migrate reset`, `prisma db push --force-reset`, `DROP`, `TRUNCATE`…
   - Không sửa migration đã tồn tại. Thay đổi schema chỉ bằng **migration mới, ưu tiên thêm (additive)**.
   - Trước khi chạy migration đầu tiên, hướng dẫn tôi sao lưu DB (lệnh `pg_dump`/`mysqldump` tuỳ loại DB) và **chờ tôi xác nhận** (xem điểm dừng ở Giai đoạn 6).
3. **Không sửa giao diện Frontend.** Nếu response của BE lệch với mock thì **sửa BE cho khớp contract**. Chỉ được sửa FE ở lớp cấu hình API (baseURL, interceptor gắn token, refresh token) và chỉ khi thật sự cần, có ghi lý do.
4. Không ghi bí mật (mật khẩu DB, JWT secret, key VNPAY/MoMo…) vào code hay tài liệu. Dùng `.env` và tạo `.env.example` đầy đủ tên biến.
5. Dùng đúng phong cách sẵn có của `apps/api` (cấu trúc module, đặt tên, thư viện validation, logger). Chỉ thêm thư viện khi cần, ghi tên, lý do và phiên bản vào `docs/BE_PROGRESS.md`.
6. Chỉ dừng hỏi tôi khi gặp vấn đề chặn hoặc ở **điểm dừng bắt buộc** (Giai đoạn 6). Còn lại tự chọn phương án hợp lý, ghi giả định vào báo cáo và làm tiếp.
7. Sau mỗi giai đoạn, cập nhật **`docs/BE_PROGRESS.md`**: đã làm gì, file nào, lệnh đã chạy, test, còn gì, lỗi gì.

---

## GIAI ĐOẠN 1 — ĐỌC TÀI LIỆU
Đọc hết mọi file trong `docs/`, đặc biệt:
- `PROJECT_ANALYSIS.md`: phân tích DB/BE/FE trước đây.
- `FE_PROGRESS.md`: tình trạng FE, **các đề xuất bảng/API đã ghi lại** (gồm phần 360°).
- `WIREFRAME.md`: mục 5 "Thực thể dữ liệu", mục 7 (màn hình bổ sung), mục 7C (luồng).
- `PROMPT_AGENT_FE.md`, `PROMPT_360_SAN_PHAM.md`: các quy tắc nghiệp vụ đã thống nhất với FE.
- `mock-data/README.md` trong `apps/web`: tài khoản test, cấu trúc dữ liệu.

Ghi lại các quy tắc nghiệp vụ tìm được.

## GIAI ĐOẠN 2 — QUÉT DATABASE
1. Đọc `database/`, `infra/` (docker-compose, script khởi tạo), `schema.prisma` (hoặc ORM khác), toàn bộ migrations, seed.
2. Kiểm tra trạng thái DB **chỉ đọc**:
   - `npx prisma migrate status`.
   - So sánh schema với DB thật bằng `npx prisma migrate diff` hoặc `prisma db pull --print` (**không ghi đè file schema**).
3. Ghi lại cho từng bảng: cột, kiểu, ràng buộc, enum, index, quan hệ. Vẽ ERD bằng Mermaid.

## GIAI ĐOẠN 3 — QUÉT BACKEND HIỆN CÓ
- Phiên bản NestJS và các gói. File `main.ts` (prefix `/api`?, CORS, pipes, port).
- Cấu trúc module, controller, service, DTO, guard, interceptor, filter, config, logger, queue (BullMQ/Redis nếu có), mail, upload, Swagger, test (unit/e2e).
- `packages/`: có gói dùng chung (types, DTO, zod schema, config eslint/tsconfig) không. Nếu có, **BE và FE phải dùng chung type** qua gói đó.
- Bảng endpoint hiện có: Method · Path · Guard · DTO · Trạng thái (hoạt động / làm dở / lỗi).
- CI trong `.github/workflows`, hook trong `.husky`: lệnh nào phải pass.

## GIAI ĐOẠN 4 — TRÍCH XUẤT API CONTRACT TỪ FRONTEND
Đây là bước quan trọng nhất. Đọc **toàn bộ lớp mock API và service layer** của `apps/web`. Với **mọi** request FE gọi, ghi:
- Method, path, query (phân trang, lọc, sắp xếp, tìm kiếm), body, header (token).
- **Hình dạng response chính xác**: envelope, tên trường, kiểu, enum, cấu trúc phân trang, định dạng ngày.
- Mã lỗi và thông báo lỗi FE đang xử lý (401, 403, 404, 409, 422…).
- Màn hình nào dùng request đó.

Xuất ra **`docs/API_CONTRACT.md`**, nhóm theo module. Kèm schema JSON hoặc TypeScript cho từng response. Đây là tài liệu Backend phải tuân theo.

## GIAI ĐOẠN 5 — THIẾT KẾ BACKEND
Viết **`docs/BACKEND_DESIGN.md`** gồm:
1. **Kiến trúc**: sơ đồ module NestJS, luồng request (guard → pipe → controller → service → Prisma), cấu trúc thư mục đề xuất, xử lý lỗi, logging, cấu hình.
2. **So sánh Contract ↔ BE ↔ DB (gap analysis)**, dạng bảng: endpoint · có ở BE? · bảng DB cần · thiếu gì.
3. **Thiết kế schema DB mới/bổ sung** (ERD Mermaid + danh sách migration). Bao phủ tối thiểu:
   - Người dùng & xác thực: users (role ADMIN/CUSTOMER, nhóm khách hàng, trạng thái khoá), refresh tokens, password reset OTP, addresses.
   - Danh mục cây 2 cấp; products; variants (màu × kích thước, SKU, giá, giá gốc, tồn kho, giá vốn, mức tồn tối thiểu, kích thước D×R×C); product images; specs; **product 360 config + frames theo màu**; models 3D (GLB/USDZ); spaces + 360 images + hotspots + suggested products.
   - Carts, wishlists; promotions/coupons (loại %, tiền, freeship; điều kiện; phạm vi theo danh mục/sản phẩm/không gian; giới hạn lượt) + user coupons + lượt sử dụng.
   - Orders, order items (lưu snapshot tên/giá/biến thể), order status history, payments (phương thức, trạng thái, mã giao dịch cổng, raw callback), shipping zones & fees.
   - Reviews (ảnh, ẩn/hiện, chỉ từ đơn đã giao), questions/answers, return requests (+ items, ảnh, trạng thái), notifications.
   - Banners, posts, static pages, FAQ, contact messages.
   - Suppliers, stock receipts (nhập/xuất) + items, expenses (danh mục chi), store settings, activity logs.
   
   Đối chiếu từng bảng với tên trường trong contract. **Tên trường API phải khớp contract**; tên cột DB có thể khác và được map ở tầng DTO/serializer.
4. **Quy tắc nghiệp vụ** (viết rõ, sẽ được test):
   - **Tính tiền ở server**: tạm tính từ giá biến thể hiện tại, giảm giá coupon (kiểm tra hạn, đơn tối thiểu, phạm vi, giảm tối đa, lượt dùng tổng và theo khách), phí ship theo khu vực + ngưỡng miễn phí, tổng = tạm tính − giảm + ship. **Không tin giá từ client.**
   - **Tồn kho**:
     - Giữ hàng (reserve) khi tạo đơn, trong transaction, khoá dòng để chống bán vượt.
     - Trừ hẳn khi đơn chuyển sang Đang giao.
     - Trả lại khi huỷ đơn hoặc khi đơn đổi trả được duyệt nhận hàng.
   - **Máy trạng thái đơn hàng**: Chờ xác nhận → Đang xử lý → Đang giao → Đã giao. Huỷ chỉ khi Chờ xác nhận / Đang xử lý (khách tự huỷ chỉ khi Chờ xác nhận). Mọi lần đổi trạng thái đều ghi history và tạo notification cho khách.
   - **Mã đơn** `ORD` + số tăng dần (không trùng khi chạy đồng thời). **Mã đổi trả** `RT` + số.
   - **Thanh toán**:
     - COD: đã thanh toán khi giao thành công.
     - VNPAY sandbox: tạo URL, xử lý return URL và IPN, kiểm tra chữ ký, idempotent.
     - MoMo / ZaloPay: interface + stub sandbox.
   - **Đánh giá**: chỉ sản phẩm thuộc đơn Đã giao của chính khách, 1 đánh giá / sản phẩm / đơn. Cập nhật rating trung bình và số lượng.
   - **Đổi trả**: trong 7 ngày kể từ khi giao. Luồng Chờ duyệt → Đang lấy hàng → Đang kiểm tra → Đã hoàn tiền / Đã đổi | Từ chối. Hoàn tiền thì tự tạo phiếu chi (danh mục Hoàn tiền).
   - **Kho & thu chi**: phiếu nhập hoàn tất thì cộng tồn và tạo phiếu chi giá vốn. Báo cáo: tổng thu (đơn đã thanh toán), tổng chi, lợi nhuận, biên lợi nhuận, theo ngày/tháng/danh mục/kênh thanh toán, bảng kết quả kinh doanh như màn hình 7.28.
   - **Quên mật khẩu**: OTP 6 số, hết hạn 5 phút, tối đa 5 lần thử, chống spam gửi lại (60 giây). Môi trường dev in OTP ra log.
5. **Bảo mật**:
   - Mật khẩu bằng bcrypt/argon2.
   - JWT access ngắn hạn + refresh token xoay vòng (theo cách FE đang lưu: cookie httpOnly hoặc header Bearer, **khớp với FE**).
   - Guard `@Roles('ADMIN')` cho mọi route `/admin/*`; khách chỉ truy cập dữ liệu của chính mình.
   - Validate mọi input (class-validator hoặc zod sẵn có). Helmet, CORS cho `http://localhost:3000`, rate limit cho đăng nhập/OTP/đặt hàng.
   - Upload kiểm tra MIME + dung lượng (ảnh ≤ 5MB; GLB/USDZ ≤ 50MB; frame 360 ≤ 2MB/ảnh). Chống path traversal.
6. **Upload & lưu trữ**: abstraction `StorageService`, bản dev lưu local (`apps/api/uploads`, phục vụ tĩnh). Có sẵn chỗ thay bằng S3/Cloudinary qua biến môi trường.
7. **Kế hoạch triển khai**: thứ tự module, ước lượng, rủi ro.

## GIAI ĐOẠN 6 — ⛔ ĐIỂM DỪNG BẮT BUỘC
Khi xong Giai đoạn 1–5, **dừng lại** và gửi tôi bản tóm tắt:
- Danh sách thay đổi schema DB (bảng/cột thêm mới, sửa, có thay đổi nào có thể làm mất dữ liệu không).
- Các mâu thuẫn quan trọng giữa contract FE và DB hiện tại, kèm cách bạn định xử lý.
- Lệnh sao lưu DB tôi cần chạy.

**Chỉ tiếp tục khi tôi trả lời "Đồng ý".**

## GIAI ĐOẠN 7 — NỀN TẢNG
1. Cấu hình:
   - `@nestjs/config` có validate biến môi trường.
   - Global prefix theo contract (ví dụ `/api`).
   - `ValidationPipe` (whitelist, transform).
   - **Interceptor bọc response đúng envelope của contract.**
   - **Exception filter** trả lỗi đúng định dạng FE xử lý, thông báo tiếng Việt.
   - Helper phân trang/lọc/sắp xếp dùng chung.
2. `PrismaService`, transaction helper, xử lý soft delete nếu dùng.
3. **Swagger** tại `/api/docs` có auth Bearer, ví dụ request/response.
4. Health check `GET /api/health`. Logger có request id.
5. Nếu `infra/` có docker-compose (Postgres/MySQL, Redis, Mailhog…) thì dùng; nếu chưa có thì bổ sung `infra/docker-compose.dev.yml` cho DB + Mailhog.

## GIAI ĐOẠN 8 — MIGRATION & SEED
1. Viết migration mới theo thiết kế đã được duyệt. Chạy trên DB dev bằng `npx prisma migrate dev --name <ten>`.
2. **Seed dữ liệu từ chính mock-data của FE**, để giao diện khi dùng API thật giống hệt khi dùng mock:
   - Viết script đọc file trong `apps/web/.../mock-data/`, map sang bảng DB, băm mật khẩu tài khoản test, copy ảnh mock (gồm frame 360) sang storage.
   - Seed idempotent (chạy lại không nhân đôi).
   - Lệnh: `npm run db:seed -w <tên-gói-api>`.
3. Tài khoản sau seed phải đăng nhập được:
   - `admin@aurelia.vn` / `admin123` (doanh nghiệp).
   - `khachhang@aurelia.vn` / `123456` (khách hàng có sẵn giỏ hàng, đơn hàng, coupon, thông báo).

## GIAI ĐOẠN 9 — XÂY DỰNG MODULE
Làm theo thứ tự. Mỗi module gồm DTO, service, controller, guard, test, Swagger. Endpoint đúng path và response như `docs/API_CONTRACT.md`.

1. **Auth**: đăng ký, đăng nhập (khách / admin riêng nếu contract tách), đăng xuất, refresh, `me`, quên mật khẩu (gửi OTP qua mail, dev dùng Mailhog/log), xác thực OTP và đặt lại, đổi mật khẩu. Đăng nhập Google: tạo endpoint và cấu hình OAuth qua biến môi trường. Nếu chưa có key thì trả lỗi rõ ràng, không làm hỏng các luồng khác.
2. **Users & Addresses**: hồ sơ, avatar, sổ địa chỉ (đúng 1 mặc định).
3. **Catalog**:
   - Danh mục cây.
   - Danh sách sản phẩm: lọc danh mục, giá, màu, chất liệu, phong cách; sắp xếp; phân trang; tìm kiếm không dấu tiếng Việt.
   - Chi tiết sản phẩm theo slug, variants, ảnh, thông số.
   - **`GET /products/:slug/360`**, sản phẩm liên quan, sản phẩm nổi bật / mới.
4. **3D & Không gian mẫu**: models 3D theo sản phẩm; danh sách/chi tiết không gian, hotspots, sản phẩm gợi ý, giá combo.
5. **Cart & Wishlist**: thêm/sửa/xoá theo `variantId`, kiểm tra tồn kho, áp/gỡ coupon, tính tổng phía server, gộp giỏ hàng khách vãng lai (nếu FE có) sau đăng nhập.
6. **Checkout & Orders**: tạo đơn (transaction + reserve tồn), thanh toán COD/VNPAY (return + IPN), đơn của tôi (lọc trạng thái), chi tiết, huỷ, mua lại.
7. **Reviews, Q&A, Returns, Notifications** (khách).
8. **Content công khai**: banner, bài viết, trang tĩnh, chính sách, FAQ, gửi liên hệ, cài đặt cửa hàng công khai (hotline, phí ship).
9. **Admin** (tất cả cần role ADMIN):
   - Dashboard: KPI, doanh thu theo ngày, tỉ lệ trạng thái, hoạt động gần đây, đơn gần đây, bán chạy.
   - CRUD sản phẩm (6 tab, gồm biến thể, upload ảnh, **tab Ảnh 360°: `GET|PUT /admin/products/:id/360`** + upload nhiều frame), không gian mẫu (ảnh 360, hotspot), danh mục, mô hình 3D (upload GLB/USDZ).
   - Đơn hàng: danh sách, chi tiết, chuyển trạng thái, xác nhận thanh toán, mã vận đơn, ghi chú nội bộ, in hoá đơn (trả dữ liệu, FE in).
   - Đổi trả: duyệt / từ chối / hoàn tiền.
   - Khách hàng: danh sách, chi tiết, khoá/mở.
   - Đánh giá: ẩn/hiện. Hỏi đáp: trả lời/ẩn.
   - Khuyến mãi: CRUD.
   - Kho: tồn kho, phiếu nhập/xuất, nhà cung cấp.
   - Thu chi: phiếu chi, báo cáo, xuất Excel/CSV.
   - Nội dung: banner (sắp xếp), bài viết, trang tĩnh.
   - Cài đặt: cửa hàng, cổng thanh toán, phí ship.
10. **Activity log** ghi lại hành động quan trọng của admin và khách.

## GIAI ĐOẠN 10 — KIỂM THỬ
1. **Unit test** cho logic quan trọng: tính tiền + coupon, phí ship, máy trạng thái đơn, reserve/trả tồn kho, quy tắc đánh giá, quy tắc đổi trả 7 ngày, OTP, chữ ký VNPAY.
2. **E2E test** (supertest) trên DB test riêng (`DATABASE_URL_TEST`): luồng đăng ký → đăng nhập → thêm giỏ → áp mã → đặt hàng → admin chuyển trạng thái → đánh giá → đổi trả → hoàn tiền → báo cáo thu chi cập nhật. Kiểm tra khách không vào được `/admin/*` (403) và không xem được đơn của người khác.
3. **Contract test**: với mỗi endpoint trong `API_CONTRACT.md`, kiểm tra response thật khớp schema (dùng type/zod chung trong `packages/` nếu có).
4. Chạy `lint`, `typecheck`, `test`, `build` qua turbo ở thư mục gốc. Tất cả phải pass, kể cả hook husky và workflow CI.

## GIAI ĐOẠN 11 — NỐI FRONTEND VỚI BACKEND THẬT
1. Trong `apps/web/.env.development.local` đặt `NEXT_PUBLIC_USE_MOCK=false` và `NEXT_PUBLIC_API_URL=http://localhost:<port-api>/api` (tên biến theo cấu hình FE hiện có). Giữ chế độ mock vẫn chạy được khi bật lại `true`.
2. Chạy song song API và web (`npm run dev` ở gốc qua turbo), chạy lại **toàn bộ test Playwright của FE với API thật**. Sửa mọi chỗ lệch **ở phía BE**.
3. Tự kiểm tra thủ công các luồng chính và trang 360°. Ghi kết quả vào `docs/BE_PROGRESS.md`.

## GIAI ĐOẠN 12 — TÀI LIỆU & BÀN GIAO
1. Cập nhật README (gốc và `apps/api`):
   - Yêu cầu cài đặt.
   - Khởi động DB bằng docker.
   - Tạo `.env` từ `.env.example`.
   - `migrate`, `seed`, chạy dev.
   - URL Swagger, tài khoản test.
   - Cách bật/tắt mock ở FE.
   - Cấu hình VNPAY sandbox.
2. Hoàn thiện `docs/API_CONTRACT.md` (khớp code cuối cùng), `docs/BACKEND_DESIGN.md`, `docs/BE_PROGRESS.md` (bảng module · endpoint · test · trạng thái ✅/🟡/❌, việc còn tồn đọng).
3. Kết thúc bằng tóm tắt ngắn: lệnh chạy, link Swagger, những gì đã xong, những gì cần tôi làm (ví dụ đăng ký key VNPAY sandbox, Google OAuth).

=====
