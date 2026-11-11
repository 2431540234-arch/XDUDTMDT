// Mã khách vãng lai ẩn danh (UUID do trình duyệt tự tạo) để ghi thống kê lượt xem (UC-SPACE-06).
const KEY = 'aurelia-visitor-id';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
