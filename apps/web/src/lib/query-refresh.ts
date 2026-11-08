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

/**
 * Áp quy tắc "ghi xong thì không để lần tải cũ đang bay ghi đè" cho MỌI chỗ dùng QueryClient của ứng dụng:
 *  • `invalidateQueries` hủy lần tải đang bay của các query khớp rồi mới làm mới (như `refreshAfterWrite`);
 *  • `setQueryData` (ghi kết quả máy chủ trả về vào cache) hủy lần tải đang bay của đúng khóa đó, nếu không lần tải
 *    cũ trả về sau sẽ đè mất dữ liệu mới.
 * Nhờ vậy ~80 chỗ "ghi rồi invalidate/setQueryData" (admin và khách) dùng chung một cách, không sửa riêng từng chỗ.
 */
export function makeWriteSafe<T extends QueryClient>(qc: T): T {
  const invalidate = qc.invalidateQueries.bind(qc);
  qc.invalidateQueries = (filters, options) =>
    qc.cancelQueries(filters).then(() => invalidate(filters, options));
  const setData = qc.setQueryData.bind(qc);
  qc.setQueryData = ((key: QueryKey, updater: unknown, options?: unknown) => {
    void qc.cancelQueries({ queryKey: key, exact: true });
    return (setData as (k: QueryKey, u: unknown, o?: unknown) => unknown)(key, updater, options);
  }) as typeof qc.setQueryData;
  return qc;
}
