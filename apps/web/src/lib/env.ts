// Biến môi trường phía web. NEXT_PUBLIC_API_URL được kiểm tra khi khởi động trong next.config.js;
// kiểm tra lại ở đây để lỗi rõ ràng nếu module được nạp ở ngữ cảnh khác (test, script).
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('Thiếu biến môi trường NEXT_PUBLIC_API_URL (xem .env.example).');
}

export const env = {
  apiUrl: apiUrl.replace(/\/+$/, ''),
} as const;
