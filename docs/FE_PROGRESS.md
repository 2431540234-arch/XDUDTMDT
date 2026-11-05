# Tiến độ dựng Frontend theo wireframe (nhánh `feature/fe-wireframe-mock`)

> Mở phiên mới: "Đọc docs/FE_PROGRESS.md và tiếp tục từ bước đang dở theo docs/PROMPT_AGENT_FE.md".

## Trạng thái giai đoạn
| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 1–5 | Đọc tài liệu, quét DB/BE/FE, báo cáo `docs/PROJECT_ANALYSIS.md` | ✅ |
| 6 | Design system (tokens, UI nền tảng, layout, component storefront + admin) | ✅ |
| 7 | `apps/web/src/mock-data/` + mock API (~140 endpoint) | ✅ |
| 8 | 54 màn hình | ✅ (xem bảng) |
| 9 | lint ✅, typecheck ✅, 15 unit test ✅, `next build` ✅, 7 e2e Playwright ✅ | ✅ |

## Bảng 54 màn hình
✅ = dựng đủ, e2e duyệt không lỗi console/HTTP/ảnh vỡ · 🟡 = lệch nhỏ so với wireframe.

| # | Màn hình | Route | TT | Ghi chú |
|---|---|---|---|---|
| 1 | Trang chủ | `/` | ✅ | |
| 2 | Danh sách SP | `/products` | ✅ | |
| 3 | Chi tiết SP | `/products/[slug]` | ✅ | |
| 4 | Giỏ hàng | `/cart` | ✅ | |
| 5 | Thanh toán | `/checkout` | ✅ | |
| 6, 7 | Đăng nhập / Đăng ký | `/login`, `/register` | ✅ | Google giả lập |
| 8 | Tài khoản cá nhân | `/account/profile` | ✅ | |
| 9 | Mã giảm giá | `/account/coupons` | ✅ | |
| 10 | Đơn hàng của tôi | `/account/orders` | ✅ | |
| 11 | Đánh giá của tôi | `/account/reviews` | ✅ | |
| 12 | Yêu thích | `/wishlist` | ✅ | |
| 13 | Tìm kiếm | `/search` | ✅ | |
| 14 | Không gian mẫu | `/spaces` | ✅ | |
| 15 | Admin tổng quan | `/admin` | ✅ | |
| 16, 17 | Admin SP (DS + form 6 tab) | `/admin/products[/new,/id]` | ✅ | |
| 18, 19 | Admin không gian (DS + form 5 tab) | `/admin/spaces[/new,/id]` | ✅ | hotspot đặt bằng click trên ảnh 2D |
| 20, 47 | Admin danh mục + modal | `/admin/categories` | ✅ | |
| 21, 44 | Admin đơn hàng + chi tiết | `/admin/orders[/code]` | ✅ | |
| 22, 46 | Admin khách hàng + chi tiết | `/admin/customers[/id]` | 🟡 | thiếu tab "Mã giảm giá" ở chi tiết KH |
| 23 | Admin đánh giá | `/admin/reviews` | 🟡 | không có "+ Thêm đánh giá" (D-N06) |
| 24, 49 | Admin mô hình 3D + modal | `/admin/models` | ✅ | tiến trình tải giả lập |
| 25, 48 | Admin khuyến mãi + tạo/sửa | `/admin/promotions[/new,/id]` | ✅ | phạm vi theo SP/không gian chỉ ghi nhận |
| 26 → 54 | Admin báo cáo thu chi | `/admin/reports` | ✅ | thay cho 3.10 |
| 27 | Chi tiết đơn (khách) | `/account/orders/[code]` | ✅ | |
| 28 | Đặt hàng thành công/thất bại | `/checkout/success`, `/failed` | ✅ | |
| 29, 30 | Quên / đặt lại mật khẩu | `/forgot-password`, `/reset-password` | ✅ | OTP `123456` |
| 31 | Đổi mật khẩu | `/account/password` | ✅ | |
| 32 | Chi tiết không gian mẫu | `/spaces/[slug]` | ✅ | viewer 360° bằng R3F; chưa vẽ mô hình đặt trong ảnh |
| 33 | Trình xem 3D/AR | `/products/[slug]/3d` | 🟡 | mã QR AR là minh họa |
| 34 | Modal viết/sửa đánh giá | — | ✅ | |
| 35 | Yêu cầu đổi trả + DS | `/account/returns[/new]` | ✅ | |
| 36 | Thông báo | `/account/notifications` | ✅ | |
| 37–40 | Về chúng tôi, Liên hệ, FAQ, Chính sách | `/about`, `/contact`, `/faq`, `/policies/[slug]` | 🟡 | bản đồ là khung minh họa |
| 41 | Giỏ hàng trống | `/cart` | ✅ | |
| 42 | 404 | `*` | ✅ | |
| 43 | Admin đăng nhập | `/admin/login` | ✅ | |
| 45 | Admin đổi trả | `/admin/returns` | ✅ | |
| 50 | Admin hỏi đáp | `/admin/questions` | ✅ | |
| 51 | Admin nội dung | `/admin/content` | 🟡 | tab "Menu & footer" chỉ hiển thị thông tin |
| 52 | Admin cài đặt | `/admin/settings` | 🟡 | Email/Giao diện/SEO/Bảo mật chỉ hiển thị thông tin |
| 53 | Admin kho hàng | `/admin/inventory` | ✅ | |

So sánh ảnh chụp 1440px trang chủ và chi tiết sản phẩm với `wireframes/01`, `03`: khớp bố cục, thứ tự section, màu. Các trang khác kiểm bằng e2e, chưa so từng ảnh.

## Thư viện thêm
Không thêm thư viện mới.

## File cũ đã sửa (kèm lý do)
- `styles/{theme.ts,globals.css}`, `tailwind.config.ts`: design tokens theo WIREFRAME 0.1 (primary `#8B5E3C` → `#8B4A2B`).
- Các file khung 5 dòng (components, hooks, services, store, lib, types) được điền nội dung, không đổi tên.
- `app/providers.tsx`: thêm `<Toaster />`, nạp phiên đăng nhập sau khi mount.
- `app/page.tsx`, `(shop)/*`, `(auth)/*`, `admin/products/*`: thay trang khung; `admin/dashboard` → chuyển hướng `/admin`.
- `next.config.js`: bỏ yêu cầu `NEXT_PUBLIC_API_URL` khi `NEXT_PUBLIC_USE_MOCK=true`.
- `vitest.config.mts` (alias `@`), `playwright.config.ts` (bật mock, 1 worker), `tests/e2e/home.spec.ts` (theo trang chủ mới), `types/model-viewer.d.ts` (`camera-orbit`).

## Việc còn tồn đọng / cần quyết định
- Backend thật mới là khung rỗng: mọi endpoint ngoài `media`/`models presign` chỉ có ở mock (đánh dấu `TODO: chưa có trong BE`).
- Thực thể chưa có trong DB (đổi trả, hỏi đáp, banner, bài viết, kho, phiếu chi…): cần quyết định có thêm bảng/migration không.
- Tài liệu UML lớn (`BAO_CAO_…`, `docs/diagrams`) chỉ đọc mục lục.
