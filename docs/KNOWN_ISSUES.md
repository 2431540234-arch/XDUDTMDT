# Lỗi đã biết và việc còn tồn đọng

> Cập nhật lần cuối: 2026-11-11 – theo nhánh `fix/remaining-issues` (commit `cbfabbb`).
> Mỗi mục có bằng chứng (tệp:dòng, số liệu, commit) hoặc ghi "Cần xác minh". Báo cáo gốc của backlog: [AUDIT_REPORT.md](AUDIT_REPORT.md) mục 7–9.

## Tóm tắt trạng thái

| Mục | Trạng thái |
| --- | --- |
| 1. Lỗi hydration `Breadcrumb` `/products` | **Đã sửa** (`3d4e8df` test, `2cab543` code) |
| 2. Hàm `visit` của test bỏ sót cảnh báo | **Đã sửa** (`3d4e8df`) |
| 3. Đăng nhập Google | **Đã hoãn** (giai đoạn sau) |
| 4. Backlog P2 | **Một phần**: xong `database/*.sql`, TODO lỗi thời, `/about`, `/contact` (một phần), comment trỏ tài liệu lưu trữ, `mock-data/README.md`; còn các việc ở mục 4 |
| 5. `aurelia_dev` migration `remove_ar` | **Đã áp** (2026-11-11) |
| 5. `Dockerfile.web` / `NEXT_PUBLIC_API_URL` | **Đã sửa và kiểm chứng bằng Docker** (`a8c0d58`) |

## 1. Lỗi hydration ở `Breadcrumb` của trang `/products` — ĐÃ SỬA

**Triệu chứng:** test Playwright `storefront công khai` (nhóm `khach-hang`) thỉnh thoảng đỏ vì lỗi hydration ở `/products?category=sofa`:

```
Warning: Expected server HTML to contain a matching <%s> in <%s>.%s a span
    at a  at LinkComponent  at span  at nav  at Breadcrumb  at div  at ProductListing  at Suspense  at ProductsPage (Server)
```

**Nguyên nhân gốc (chứng minh bằng thực nghiệm):** máy chủ không có fetch danh mục (`useCategories()` là `useQuery` thuần, `src/hooks/useProducts.ts:27`), nên HTML SSR luôn có breadcrumb 2 mục với "Sản phẩm" là `<span>`. `Header` (ngoài `<Suspense>`, `Header.tsx:245`) và `ProductListing` (trong `<Suspense>`, `src/app/(shop)/products/page.tsx:9`) dùng chung khóa cache `['categories']`. `Header` hydrate trước và nạp danh mục vào cache; nếu `ProductListing` hydrate muộn hơn lúc dữ liệu về thì lần render đầu của client đã có `currentCat` (breadcrumb 4 mục, "Sản phẩm" thành `<a>`) ⇒ lệch HTML máy chủ. Chỉ xảy ra ở `next dev` (SSR theo yêu cầu); bản production prerender `/products` thành tĩnh nên không có HTML máy chủ để lệch (đã kiểm: `next build` + `next start`, hydration 20/20 xanh, SSR không có `<nav>`).

**Cách sửa (`2cab543`):** hook `useHydrated()` (`src/hooks/useHydrated.ts`, `useSyncExternalStore` với `getServerSnapshot = false`): `false` ở máy chủ và lần render đầu của client khi đang hydrate, `true` ngay sau đó (và `true` ngay khi dựng bằng điều hướng phía client, không có hydrate). `ProductListing.tsx` chỉ dùng `cats.data` khi `hydrated`. Chọn cách này thay vì tự `useEffect`+`useState` vì không có khung hình thừa và là cơ chế React hỗ trợ chính thức; breadcrumb vẫn đổi từ 2 mục sang 4 mục khi danh mục về (đúng như luồng điều hướng phía client trước đây), không đổi bố cục. Unit test `tests/unit/use-hydrated.test.tsx` (có ca đối chứng: không dùng hook ⇒ lỗi hydration).

**Số liệu** (`tests/e2e/hydration.spec.ts`, `next dev`, 1 worker, CPU throttling bằng CDP, không dùng tiến trình nền):

| Mức CPU | Trước khi sửa (20 lần) | Sau khi sửa (30 lần) |
| --- | --- | --- |
| Bình thường (1×) | đỏ 15/20 (75 %) | **đỏ 0/30** |
| Chậm 4× | đỏ 20/20 (100 %) | **đỏ 0/30** |

Bản production (`next build` + `next start`, mock=false): hydration 10 lần mỗi mức, 20/20 xanh.

**Rà các nơi khác dùng cache dùng chung dưới `Suspense` (chỉ báo cáo, không sửa):** `ProductListing` còn được dùng cho `/search` (chế độ `search`, breadcrumb không phụ thuộc danh mục nên không lệch; đo CPU 4×, 4 lần: 0 lỗi). Các trang bọc `Suspense` khác (`/spaces`, `/checkout*`, `/login`, `/register`, `/reset-password`, `/verify-email`, `/account/orders`, `/account/returns/new`, `/admin/models`) dùng khóa cache riêng hoặc dữ liệu chỉ có ở client (cần đăng nhập), không dùng chung khóa với `Header` (`['categories']`, `['cart']`, `['wishlist']`, `['notifications']`). Đo 13 trang công khai ở CPU 4× (mỗi trang 4 lần, code chưa sửa): **không lộ thêm lỗi hydration** (52/52). Các trang dùng `useCategories()` ngoài `Suspense` (`/`, `/admin/*`) hydrate cùng lượt với `Header` nên không có điều kiện đua; **Cần xác minh** nếu về sau bọc chúng trong `Suspense`.

## 2. Hàm `visit` của test bỏ sót cảnh báo đến sớm — ĐÃ SỬA

`apps/web/tests/e2e/helpers/visit.ts` (tách khỏi `screens.spec.ts`, `3d4e8df`): đăng ký bộ bắt lỗi và **reset mảng lỗi TRƯỚC `goto`** (trước đây `errors.length = 0` sau `goto` xóa cảnh báo đến sớm), chờ hydrate xong (`main`, `h1`, breadcrumb đã có fiber React) rồi mới kết luận, dùng `expect.soft` để liệt kê mọi trang lỗi trong một lượt, và hỗ trợ `cpuRate` (CDP throttling). Thêm `hydration.spec.ts` (CPU 1× và 4×) vào nhóm `khach-hang`. Trên code chưa sửa, test đỏ ổn định (xem số liệu mục 1); với `visit` mới chạy cả nhóm `khach-hang` không lộ lỗi hydration ở trang nào khác.

## 3. Đăng nhập Google — ĐÃ HOÃN (giai đoạn sau)

- **Hiện trạng:** `POST /auth/google` luôn `503 SERVICE_UNAVAILABLE` (`apps/api/src/modules/auth/auth.service.ts`, `google()`); nút ở `/login`, `/register` **ẩn** mặc định, chỉ hiện khi `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true` (`GoogleButton.tsx`). Quyết định: [DECISIONS.md](DECISIONS.md) D-P17. Còn một `TODO` thật ở `apps/web/src/services/auth.api.ts:33`.
- **Việc cần làm khi triển khai:**
  1. Tạo OAuth client (Web) trên Google Cloud Console.
  2. Cấu hình callback/redirect URL từng môi trường; đặt `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ([ENVIRONMENT.md](ENVIRONMENT.md)).
  3. Viết luồng BE: xác minh ID token/mã đăng nhập, tạo hoặc tìm tài khoản, cấp cặp token như đăng nhập thường, ghi `user_sessions`.
  4. Xử lý **liên kết tài khoản trùng email** (chỉ liên kết khi email Google đã xác minh; quyết định có yêu cầu đăng nhập lại) và tài khoản bị khóa.
  5. Bật lại nút bằng `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true` (biến lúc build) và bỏ ghi chú "giả lập" ở `GoogleButton.tsx`.
  6. Viết test (supertest cho BE; Playwright cho FE với Google giả), cập nhật [API_CONTRACT.md](API_CONTRACT.md).

## 4. Backlog P2

| Việc | Trạng thái | Chi tiết |
| --- | --- | --- |
| Thư mục `database/*.sql` lỗi thời | **Xong** (`04ce2ae`) | Không script/compose/CI nào tham chiếu (chỉ 1 bình luận trong `seed.ts`, đã sửa). Đã `git rm` 9 tệp `.sql`, viết lại `database/README.md`; nội dung cũ còn trong lịch sử git |
| TODO "chưa có trong BE/DB" lỗi thời | **Xong** (`e78ca98`, `0f54e50`) | 93 chú thích ở FE (`services`, `types/api.ts`, `mock-data`): **xóa 88** (endpoint/bảng/cột đã có, đối chiếu `docs/api/openapi.json` và `schema.prisma`), **giữ 3 TODO thật** (`Supplier` ở `types/api.ts` và `mock-data/tables/suppliers.ts`: không có bảng `suppliers`, BE lưu tên nhà cung cấp dạng chữ; Google login hoãn ở `auth.api.ts`) và 2 dòng nhắc ở tiêu đề/README; FE đã gọi API thật ở mọi chỗ nên không có logic cần sửa. 11 comment "TRẠNG THÁI: khung rỗng" đã gỡ (chỉ gỡ comment) |
| Nội dung cứng ở `/about` | **Xong** (`cf50779`) | Lấy từ trang tĩnh slug `about` qua API (có loading/lỗi/404); bỏ thống kê "50.000+…", đội ngũ giả, giá trị cốt lõi viết cứng, ảnh `/mock-img/*`. Seed không có dữ liệu mẫu (production) tạo trang `about` mặc định trung tính (`seedDefaultPages`, không ghi đè nội dung admin) |
| Nội dung cứng ở `/contact` | **Một phần** (`cf50779`) | Hotline, email, địa chỉ lấy từ `GET /settings/public` (chưa có thì "Đang cập nhật"); bỏ số liệu mẫu và 3 showroom giả. **Giờ làm việc, danh sách showroom, bản đồ** BE chưa có chỗ lưu (`settings.store` chỉ có tên, email, hotline, địa chỉ): gom vào `apps/web/src/config/site.ts` (đang để trống ⇒ ẩn). **Cần BE hỗ trợ** (mở rộng `settings.store` hoặc trang riêng) rồi đọc từ API |
| Lỗi lockfile của Next | **Giảm nhẹ** (`a8c0d58`) | `Dockerfile.web` đặt `NEXT_IGNORE_INCORRECT_LOCKFILE=1`; trên máy bị lỗi vẫn cần đặt biến khi build. Nguyên nhân gốc chưa xác định |
| Quản trị FAQ, tin nhắn liên hệ, sắp xếp banner, in hóa đơn, trang blog công khai | Chưa làm | Có ở BE, chưa có giao diện ([DAC_TA](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) mục 16) |
| 12 endpoint chưa có test tham chiếu | Chưa làm | Ví mã (`/coupons/*`), `orders/counts`, `products/:slug/related`, `spaces/facets`, `admin/users/:id/{orders,reviews,wishlist}`, sửa/xóa vị trí panorama, `auth/google` |
| Bull Board nhận token qua `?token=` | Chưa làm | `apps/api/src/modules/jobs/bull-board.middleware.ts` |
| Token đăng nhập lưu `localStorage` | Chưa làm | `apps/web/src/store/authStore.ts`; cân nhắc cookie httpOnly |

## 5. Vấn đề phát hiện khi xử lý các việc trên (2026-11-11)

- **`aurelia_dev` đã áp migration `20261109010100_remove_ar`:** `prisma migrate status` sạch, `migrate diff` rỗng. Đã xóa bảng `ar_sessions` (2 dòng), `ar_snapshots` (1 dòng), cột `products.has_ar` (1 sản phẩm đang `true`), kiểu `ar_mode`, chỉ mục `idx_products_has_3d_ar` (thay bằng `idx_products_has_3d`). **Sửa nhận định cũ:** migration KHÔNG xóa dòng `model_files` có `format='usdz'` (vẫn còn 1 dòng, giá trị enum `usdz` được giữ); các tài liệu trước đây ghi "1 tệp usdz sẽ bị xóa" là sai. Bản sao lưu trước khi áp: `../aurelia-backups/aurelia_dev_before_remove_ar_2026-11-11.sql` (ngoài repo, 281 KB).
- **`docker-compose.yml`: service `web` (profile `later`) `depends_on: api` nhưng `api` nằm ở profile `legacy`** ⇒ `docker compose --profile later config` báo "depends on undefined service" nếu không bật thêm `--profile legacy` (có từ trước, chưa sửa).
- **Module/tệp rỗng chưa dùng (chỉ báo cáo, chưa xóa):** `apps/api/src/modules/hotspots/*`, `product-images/*`, `variants/*` (controller/service/module không có route, logic đã gộp vào `admin-products`/`admin-spaces`, D-N32); `pages/pages.service.ts` và `settings/settings.controller.ts` (class rỗng); `ai/*` (3 tệp chỉ có comment, không ai import).
- **Nội dung viết cứng/giả còn lại ở chế độ thật (ngoài `/about`, `/contact`):** `apps/web/src/app/(shop)/policies/[slug]/page.tsx:20-31` (khối "7 ngày / Miễn phí / 3–5 ngày", "Hotline 0123 456 789"); ảnh `/mock-img/*` ở 6 nơi (`admin/login/page.tsx:56`, `not-found.tsx:65`, `app/page.tsx:190`, `AuthLayout.tsx:28`, `ProductListing.tsx:106`, `account/profile/page.tsx:124`); `mock-data` còn khoảng 14 chỗ nhắc "AR" (ví dụ `metaDescription` "xem 3D/AR trước khi mua").
- **Dump CSDL từng nằm trong repo:** `docs/aurelia_dev_backup.sql` (UTF-16, 448 KB) chứa 3 hash mật khẩu bcrypt của tài khoản seed (`admin@aurelia.vn`, `nguyenvana@example.com`, `tranthib@example.com`), email/số điện thoại mẫu; không thấy token hay email thật. Mật khẩu mặc định của các tài khoản này công khai trong README. Repo là **public** nên các hash nằm trong lịch sử git (chưa xử lý lịch sử); nếu các tài khoản seed từng dùng ở môi trường thật, đổi mật khẩu.
- **Tệp cá nhân `docs/PROMPT_AGENT_BE.md`** bị `.gitignore` chặn (không thuộc repo).
- **Chưa rà từng dòng:** `docs/QUY_UOC_CODE_DB.md` (chỉ grep dấu hiệu lỗi thời).
