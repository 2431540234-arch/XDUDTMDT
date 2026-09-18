// Cấu hình HTTP client gốc dùng chung cho tất cả các service gọi API backend

export const apiClient = {
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
};
