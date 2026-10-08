# Tệp mẫu cho test

| Tệp          | Nội dung                                                                                       | Nguồn và giấy phép                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sphere.glb` | Quả cầu UV ~1.536 tam giác, texture PNG 1024x1024                                              | Do dự án tự sinh bằng `generate-fixtures.mjs` (glTF-Transform + sharp). **CC0 1.0** (public domain) |
| `broken.glb` | 200 byte đầu của `sphere.glb`: đúng chữ ký "glTF" nhưng bị cắt cụt, dùng để thử nhánh `failed` | Như trên, CC0 1.0                                                                                   |

Vì sao không lấy từ Khronos glTF-Sample-Assets: mô hình `Box` ở đó dùng CC-BY 4.0 (phải ghi công), không phải CC0. Tệp tự sinh tránh được ràng buộc này và nhỏ gọn.

Sinh lại: `node apps/api/test/fixtures/generate-fixtures.mjs` (chạy từ thư mục gốc dự án).
