// Ngữ cảnh theo từng request (AsyncLocalStorage) để ActivityLogInterceptor biết service đã ghi nhật ký chưa.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface ActivityLogContext {
  /** true khi ActivityLogService.log đã được gọi trong request này */
  logged: boolean;
}

export const activityLogContext = new AsyncLocalStorage<ActivityLogContext>();
