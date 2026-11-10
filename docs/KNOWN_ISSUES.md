# Lỗi đã biết và việc còn tồn đọng

> Cập nhật lần cuối: 2026-11-11 – theo commit `c579fa8`.
> Chỉ ghi **nhận**, chưa sửa. Mỗi mục có bằng chứng (tệp:dòng, số liệu) hoặc ghi "Cần xác minh". Báo cáo gốc của backlog: [AUDIT_REPORT.md](AUDIT_REPORT.md) mục 7–9.

## 1. Lỗi hydration ở `Breadcrumb` của trang `/products` (chưa sửa)

**Triệu chứng:** thỉnh thoảng test Playwright `screens.spec.ts › storefront công khai` (nhóm `khach-hang`) đỏ vì lỗi hydration ở `/products?category=sofa`, chỉ khi chạy trong lượt đầy đủ, chạy riêng thì xanh.

**Thông báo nguyên văn (React, console.error):**

```
Warning: Expected server HTML to contain a matching <%s> in <%s>.%s a span
    at a
    at LinkComponent (…/next/dist/client/link.js)
    at span
    at nav
    at Breadcrumb (src/components/ui/Breadcrumb.tsx)
    at div
    at ProductListing (src/components/product/ProductListing.tsx)
    at Suspense
    at ProductsPage (Server)
```

Nghĩa là: HTML máy chủ có `<span>` nhưng lần render đầu của client dựng `<a>`.

**Khác nhau giữa server và client** (HTML thật của breadcrumb, lấy bằng `GET /products?category=sofa` và DOM sau hydrate):

| | Breadcrumb |
| --- | --- |
| Server (SSR, chưa chạy JS) | `Trang chủ` (liên kết) › `Sản phẩm` là `<span aria-current="page">` — **2 mục** |
| Client, khi danh mục đã có trong cache | `Trang chủ` › `Sản phẩm` là `<a href="/products">` › `Phòng khách` › `Sofa` — **4 mục** |

**Nguyên nhân gốc (đã chứng minh bằng thực nghiệm):**

- Không có fetch danh mục nào ở phía server: `useCategories()` là `useQuery` thuần (`src/hooks/useProducts.ts:27`), nên SSR luôn render **không có dữ liệu danh mục** (`currentCat = null`).
- Hai component dùng **chung khóa cache `['categories']`**: `Header` (`src/components/layout/Header.tsx:245`, ngoài `Suspense`) và `ProductListing` (`src/components/product/ProductListing.tsx:46`, **trong** `<Suspense fallback={null}>` ở `src/app/(shop)/products/page.tsx:9`).
- `Header` hydrate trước, gọi API danh mục và ghi vào cache React Query. Nếu `ProductListing` hydrate **muộn hơn** lúc dữ liệu về, lần render đầu của client đã có `currentCat` ⇒ breadcrumb và tiêu đề khác HTML máy chủ (`ProductListing.tsx:48-51,57-64`: `href: currentCat || has3d ? '/products' : undefined` làm "Sản phẩm" thành `<a>` thay vì `<span>`).
- Giả thuyết ban đầu "SSR fetch danh mục lỗi/chậm" là **sai**: không có SSR fetch.

**Số liệu (trang `/products?category=sofa`, `next dev`, 1 worker, mỗi chế độ 30 lần, đo ngày 2026-11-11):**

| Chế độ | Lần có lỗi hydration |
| --- | --- |
| Bình thường | 9/30 (30 %) |
| CPU chậm 4× (CDP) | 29/30 |
| CPU chậm 10× và 20× | 0/30 và 0/30 (danh mục chưa kịp áp dụng trong 1,5 giây quan sát nên không phân định được) |
| API danh mục trễ 3 giây | 0/30 |
| API danh mục trả `500` | 0/30 |
| **Trễ tải mã JS của trang `/products` 3 giây, API nhanh** | **10/10** (tái hiện ổn định) |

Quy luật: lỗi xuất hiện khi dữ liệu danh mục về **trước** lúc `ProductListing` hydrate (JS tải/chạy chậm), và biến mất khi API về sau hydrate hoặc lỗi. Test gốc `storefront công khai` chạy riêng 30 lần cho 30/30 xanh (13,4 phút) và 10/10 xanh khi nền có 12 tiến trình ngốn CPU: test **không phản ánh đúng tần suất lỗi** (xem mục 2).

**Phạm vi:** chỉ thấy ở `next dev` (SSR theo yêu cầu). Bản production prerender `/products` thành tĩnh; nội dung trong `Suspense` (dùng `useSearchParams`) chỉ render ở client nên không có HTML máy chủ để lệch — **Cần xác minh** bằng chạy bản `next start` nếu cần chắc chắn. Mẫu "nội dung SSR phụ thuộc cache React Query dưới `Suspense`" còn có thể có ở các trang có `Suspense` + `useQuery` khác (`/search`, `/spaces`, `/checkout*`, `/login`…): **Cần xác minh**, chưa đo.

**Hướng sửa dự kiến (chưa làm, cần PR riêng):** lần render đầu của client phải độc lập với trạng thái cache, ví dụ hook `useHydrated()` (`false` ở server và ở lần render client đầu, `true` sau khi mount) và chỉ dùng `cats.data` khi đã hydrate; viết test với API danh mục chậm/lỗi và `--repeat-each=30`, kỳ vọng 0 lần đỏ.

## 2. Lỗi của chính test: `visit` bỏ sót cảnh báo đến sớm

`apps/web/tests/e2e/screens.spec.ts` hàm `visit` (dòng 5-): gắn bắt lỗi `console`/`pageerror`, gọi `page.goto(..., { waitUntil: 'domcontentloaded' })` rồi **`errors.length = 0;` (dòng 18)** — xóa mọi lỗi phát sinh trước mốc đó. Cảnh báo hydration đến trước mốc `domcontentloaded` bị bỏ sót, chỉ cảnh báo đến muộn hơn mới làm test đỏ ⇒ test đỏ/xanh ngẫu nhiên dù lỗi hydration có thật ở ~30 % lần tải. **Phải sửa cùng lúc với `Breadcrumb`** (không xóa mảng lỗi sau `goto`, hoặc chỉ loại đúng các lỗi đã biết là vô hại), nếu không test sẽ tiếp tục xanh giả.

## 3. Đăng nhập Google — ĐÃ HOÃN (giai đoạn sau)

- **Hiện trạng:** `POST /auth/google` luôn `503 SERVICE_UNAVAILABLE` (`apps/api/src/modules/auth/auth.service.ts`, hàm `google()`); nút ở `/login`, `/register` **ẩn** mặc định, chỉ hiện khi `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true` (`apps/web/src/components/account/GoogleButton.tsx`). Quyết định: [DECISIONS.md](DECISIONS.md) D-P17.
- **Việc cần làm khi triển khai:**
  1. Tạo OAuth client (Web) trên Google Cloud Console.
  2. Cấu hình callback/redirect URL cho từng môi trường; đặt `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (đã khai báo ở `env.validation.ts`, [ENVIRONMENT.md](ENVIRONMENT.md)).
  3. Viết luồng ở BE: xác minh ID token/mã đăng nhập, tạo hoặc tìm tài khoản, cấp cặp token như đăng nhập thường, ghi `user_sessions`.
  4. Xử lý **liên kết tài khoản trùng email** (đã có tài khoản email/mật khẩu cùng email: chỉ liên kết khi email Google đã xác minh; quyết định có yêu cầu đăng nhập lại) và tài khoản bị khóa.
  5. Bật lại nút bằng `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true`; bỏ ghi chú "giả lập" ở `GoogleButton.tsx`.
  6. Viết test (supertest cho BE; Playwright cho FE với Google giả) và cập nhật [API_CONTRACT.md](API_CONTRACT.md).

## 4. Backlog P2 (từ AUDIT_REPORT)

| Việc | Chi tiết | Cỡ |
| --- | --- | --- |
| Thư mục `database/*.sql` lỗi thời | Còn **66 chỗ nhắc AR** (46 ở `03_tables.sql`), chỉ **44** bảng thay vì 59 (thiếu 17 bảng mở rộng, còn `ar_sessions`, `ar_snapshots`); sửa lần cuối 2026-10-06; không có script/compose dùng. Nằm ngoài `docs/` nên chưa sửa; `database/README.md` chưa rà | M |
| **93** chú thích `TODO: chưa có trong BE/DB` đã cũ | Ở `apps/web/src/services/*.api.ts` và `apps/web/src/types/api.ts`; BE/DB đã có các route/cột này (ví dụ `/coupons/me`, `gender`, `loyalty_points`) | S |
| Comment "TRẠNG THÁI: khung rỗng" | 11 tệp BE: `modules/hotspots/*`, `product-images/*`, `variants/*`, `pages/pages.service.ts`, `settings/settings.controller.ts`; module rỗng `ai`. Logic đã gộp vào `admin-products`/`admin-spaces` (D-N32) nên dễ gây hiểu nhầm | S |
| Nội dung viết cứng ở `/about` và `/contact` | `apps/web/src/app/(shop)/about/page.tsx:11-28` (số liệu "50.000+ khách hàng", tên đội ngũ), `contact/page.tsx:31` (danh sách showroom), ảnh `/mock-img/*` hiển thị ở chế độ thật | M |
| Lỗi lockfile của Next | Build web cần `NEXT_IGNORE_INCORRECT_LOCKFILE=1` trên máy bị lỗi ("Failed to patch lockfile … reading 'os'"); nguyên nhân gốc chưa xác định ([DEPLOYMENT.md](DEPLOYMENT.md), [CONG_NGHE.md](CONG_NGHE.md) mục 9) | S |
| Quản trị FAQ, tin nhắn liên hệ, sắp xếp banner, in hóa đơn, trang blog công khai | Có ở BE, chưa có giao diện ([DAC_TA](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) mục 16) | L |
| 12 endpoint chưa có test tham chiếu | Ví mã (`/coupons/*`), `orders/counts`, `products/:slug/related`, `spaces/facets`, `admin/users/:id/{orders,reviews,wishlist}`, sửa/xóa vị trí panorama, `auth/google` (đã curl 200 lúc audit) | M |
| Bull Board nhận token qua `?token=` | `apps/api/src/modules/jobs/bull-board.middleware.ts`: token có thể lọt vào nhật ký proxy/lịch sử trình duyệt | S |
| Token đăng nhập lưu `localStorage` | `apps/web/src/store/authStore.ts`: rủi ro XSS lấy token (giảm nhẹ: `RichText` không dùng `dangerouslySetInnerHTML`); cân nhắc cookie httpOnly | L |

## 5. Vấn đề phát hiện thêm khi đồng bộ tài liệu (2026-11-11)

- **`aurelia_dev` chưa áp migration `20261109010100_remove_ar`:** còn 2 phiên AR, 1 bản chụp AR, 1 cờ `has_ar`, 1 tệp usdz sẽ bị xóa khi áp. Cần sao lưu và xin phép trước ([DEPLOYMENT.md](DEPLOYMENT.md) mục 4).
- **`infra/docker/Dockerfile.web` không truyền `NEXT_PUBLIC_API_URL` lúc build** (`next.config.js` yêu cầu biến này hoặc `NEXT_PUBLIC_USE_MOCK=true`; mà `true` bị cấm khi build production) ⇒ `npm run build` trong container có thể thất bại. **Cần xác minh** bằng build thật.
- **Dump CSDL từng nằm trong repo:** `docs/aurelia_dev_backup.sql` (UTF-16, 448 KB) chứa 3 hash mật khẩu bcrypt (tài khoản seed `admin@aurelia.vn`, `nguyenvana@example.com`, `tranthib@example.com`), email/số điện thoại mẫu; không thấy token hay email thật. Mật khẩu mặc định của các tài khoản này công khai trong README. Repo là **public** nên các hash nằm trong lịch sử git (chưa xử lý lịch sử). Nếu các tài khoản seed từng được dùng trên môi trường thật, đổi mật khẩu.
- **Tệp cá nhân `docs/PROMPT_AGENT_BE.md`** bị `.gitignore` chặn (không thuộc repo) nhưng một số tài liệu còn nhắc tới (đã chuyển sang ghi chú trong [BE_PROGRESS.md](BE_PROGRESS.md)).
- **Chưa rà:** `database/README.md` và `apps/web/src/mock-data/README.md` (nằm ngoài `docs/`).
- **Mã còn nhắc tài liệu đã lưu trữ:** vài bình luận trong mã (ví dụ `apps/web/tests/e2e/product360.spec.ts` nhắc `PROMPT_360_SAN_PHAM.md`) trỏ tới tệp đã chuyển vào `docs/archive/`; không sửa vì ngoài phạm vi tài liệu.
