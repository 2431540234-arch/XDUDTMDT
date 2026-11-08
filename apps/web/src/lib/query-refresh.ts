import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Làm mới danh sách sau khi ghi dữ liệu. `invalidateQueries` KHÔNG hủy lần tải đang chạy của một query chưa có dữ liệu
 * (React Query v5 gộp vào lần tải đó), nên nếu danh sách vừa đổi bộ lọc (lần tải đầu của khóa mới) đang bay thì kết quả
 * đọc TRƯỚC khi ghi sẽ ở lại giao diện. Hủy trước rồi mới làm mới để luôn có một lần tải mới SAU thao tác ghi.
 * (Bằng chứng: trace lỗi admin-m5, GET danh sách bắt đầu 16 ms trước PATCH và không có GET nào sau PATCH.)
 */
export async function refreshAfterWrite(qc: QueryClient, queryKey: QueryKey): Promise<void> {
  await qc.cancelQueries({ queryKey });
  await qc.invalidateQueries({ queryKey });
}
