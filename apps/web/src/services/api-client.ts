// Cấu hình HTTP client gốc dùng chung cho tất cả các service gọi API backend
import { env } from '../lib/env';

export const apiClient = {
  baseURL: `${env.apiUrl}/api`,
};
