Trả lời mục 8 của CONG_NGHE.md:
1. Mobile: phương án B (tối thiểu). Làm SAU khi web xong M07 (và M12 nếu kịp). Phạm vi: danh mục, chi tiết sản phẩm, màn hình camera (CameraX) + overlay ảnh sản phẩm (kéo, xoay, phóng to), chụp ảnh ghép và lưu vào máy. Không đăng nhập, không giỏ hàng/đặt hàng trên app.
2. OTP/session: phương án A, giữ PostgreSQL. Trong bảng nộp ghi Redis = "cache, trạng thái hàng đợi, giới hạn tốc độ".
3. Redis cache: CÓ, CacheService dùng ioredis sẵn có, TTL như mục 3.3, xóa khóa khi admin sửa. Làm trong đợt M06/M07 (M01 cho settings).
4. BullMQ: CÓ queue `mail` (làm ở đợt M02) và `notification` (làm ở đợt M09). Retry 3 lần, backoff mũ.
5. AR web: @google/model-viewer. Ảnh 360°: tự dựng bằng React Three Fiber (mặt cầu + TextureLoader + drei Html cho hotspot, đặt mô hình 3D bằng useGLTF).
6. S3: không triển khai thật; làm sửa nhỏ (driver s3, S3_FORCE_PATH_STYLE, S3_ENDPOINT tùy chọn) ở cuối dự án để "chuyển S3 chỉ cần đổi biến môi trường" là đúng.
7. Bảng nộp: đồng ý thêm NestJS, Docker Compose, GitHub Actions, Swagger, Jest + Supertest, sharp, gltf-transform, model-viewer, Nodemailer + Mailpit; CÓ nhóm Mobile.
8. Ảnh overlay: tôi tự chuẩn bị PNG nền trong suốt cho 5–10 sản phẩm demo. CSDL hiện chưa có chỗ lưu ảnh overlay: đề xuất 2–3 cách (ví dụ cột/enum loại ảnh trong product_images, hoặc dùng quy ước sẵn có không cần migration), nêu ưu nhược điểm, và HỎI TÔI trước khi sửa schema.
Thêm: gỡ passport, passport-jwt, @nestjs/passport, @types/passport-jwt, cookie-parser. Thư viện web: dùng react-hook-form + @hookform/resolvers + zod (đợt M02), recharts (đợt M14); KHÔNG dùng Tiptap (trang tĩnh soạn bằng textarea Markdown). Cài thư viện theo đúng đợt cần dùng, không cài trước.

Việc cần làm bây giờ:
- Ghi tất cả quyết định trên vào docs/DECISIONS.md (đánh dấu "Đã thay thế" cho D-P03 về mobile).
- Cập nhật DAC_TA_CHUC_NANG_THEO_VAI_TRO.md: thêm nhóm UC-MOB (xem danh mục, xem chi tiết, camera + overlay, chụp và lưu ảnh), có đủ đặc tả theo mẫu; tác nhân: Khách vãng lai dùng app. Cập nhật ma trận, sơ đồ use case, mục Hướng phát triển (bỏ mobile khỏi đó, giữ ai và ar-overlay backend).
- Cập nhật BAO_CAO_PHAN_TICH_THIET_KE.md: activity + sequence cho UC camera + overlay và chụp ảnh (participant: Người dùng → Compose Screen → ViewModel → Repository → Retrofit → API / CameraX); sơ đồ kiến trúc thêm app Android; lộ trình code thêm đợt Mobile sau M07.
- Cập nhật mục 6 của CONG_NGHE.md thành BẢNG NỘP CHÍNH THỨC theo các quyết định trên.
- Cập nhật TIEN_DO.md (thêm module Mobile và các UC-MOB).
- Xuất lại ảnh sơ đồ bị ảnh hưởng (scripts/extract-diagrams.py + mermaid-cli).
- Gỡ các gói không dùng, chạy lại lint, typecheck, test, test:e2e, build.
- Commit theo nhóm: docs, chore(api).
Báo lại: số UC mới, phương án lưu ảnh overlay để tôi chọn, kết quả kiểm tra.