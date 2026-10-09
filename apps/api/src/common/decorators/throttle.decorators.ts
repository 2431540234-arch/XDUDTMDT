import { SetMetadata } from '@nestjs/common';

/** Tên bộ giới hạn tốc độ riêng cho nhóm xác thực (cấu hình ở AppModule, giá trị lấy từ THROTTLE_AUTH_*). */
export const AUTH_THROTTLER = 'auth';
export const AUTH_THROTTLE_KEY = 'authThrottle';

/**
 * Gắn lên route (hoặc controller) xác thực: đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu.
 * Bộ đếm `auth` CHỈ chạy trên route có decorator này (xem `skipIf` trong AppModule); route khác chỉ chịu giới hạn `default`.
 * Vượt giới hạn: 429 RATE_LIMITED. Số lần và thời gian đổi bằng THROTTLE_AUTH_LIMIT, THROTTLE_AUTH_TTL_SECONDS.
 */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);
