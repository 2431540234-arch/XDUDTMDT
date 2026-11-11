// Bỏ dấu tiếng Việt + chữ thường, dùng để so khớp tìm kiếm không dấu ở tầng ứng dụng (UC-CAT-06).
// Truy vấn DB dùng immutable_unaccent(lower(...)) (xem migration 0_init) nên kết quả hai bên nhất quán.
export function foldVi(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
