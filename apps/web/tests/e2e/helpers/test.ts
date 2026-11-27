// `test` dùng chung cho các spec có gọi API: fixture `request` tự gửi lại khi gặp ECONNRESET.
//
// API đóng kết nối rảnh sau 5 giây (mặc định của Node). Spec thường thao tác trên giao diện vài giây rồi mới gọi API, và
// Playwright có thể dùng lại đúng kết nối vừa bị đóng ⇒ "read ECONNRESET" ngẫu nhiên (trình duyệt tự gửi lại, còn
// APIRequestContext chỉ làm vậy khi có `maxRetries`; Playwright chỉ thử lại cho lỗi ECONNRESET, không thử lại mã HTTP).
import { test as base, type APIRequestContext } from '@playwright/test';

const SENDERS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch']);

function retryOnReset(context: APIRequestContext): APIRequestContext {
  return new Proxy(context, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (typeof key !== 'string' || !SENDERS.has(key)) return value.bind(target);
      return (url: unknown, options?: object) => value.call(target, url, { maxRetries: 2, ...options });
    },
  });
}

export const test = base.extend({
  request: async ({ request }, use) => {
    await use(retryOnReset(request));
  },
});
