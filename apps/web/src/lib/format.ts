// Các hàm định dạng dùng chung cho web

export function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}
