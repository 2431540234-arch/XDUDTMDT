/**
 * Thông tin hiển thị ở trang công khai mà BE CHƯA có chỗ lưu (`GET /settings/public` chỉ trả `store` = tên, email, hotline,
 * địa chỉ; không có giờ làm việc, danh sách showroom hay bản đồ). Gom về MỘT nơi; để trống thì phần tương ứng bị ẨN
 * (không hiển thị số liệu/địa chỉ bịa). Khi BE hỗ trợ (settings), chuyển sang đọc từ API và xóa tệp này (xem docs/KNOWN_ISSUES.md).
 */
export interface Showroom {
  city: string;
  address: string;
}

export const siteConfig: {
  /** Giờ làm việc hiển thị ở /contact, ví dụ "8:00 – 21:00 hằng ngày"; rỗng ⇒ ẩn thẻ "Giờ làm việc" */
  workingHours: string;
  /** Hệ thống showroom ở /contact; rỗng ⇒ ẩn mục "Hệ thống showroom" */
  showrooms: Showroom[];
  /** Địa chỉ nhúng bản đồ (URL iframe Google Maps); rỗng ⇒ ẩn khối bản đồ */
  mapEmbedUrl: string;
} = {
  workingHours: '',
  showrooms: [],
  mapEmbedUrl: '',
};
