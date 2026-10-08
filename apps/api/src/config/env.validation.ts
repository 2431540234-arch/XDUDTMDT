// Kiểm tra biến môi trường khi khởi động. Thiếu/sai -> dừng ngay với thông báo rõ ràng, không chạy nửa vời.
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'bắt buộc (chuỗi kết nối PostgreSQL)'),

  JWT_ACCESS_SECRET: z.string().min(16, 'bắt buộc, tối thiểu 16 ký tự'),
  JWT_REFRESH_SECRET: z.string().min(16, 'bắt buộc, tối thiểu 16 ký tự'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  STORAGE_PUBLIC_URL: z.string().default('http://localhost:4000/uploads'),

  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('Aurelia Living <no-reply@aurelia.local>'),

  SWAGGER_ENABLED: bool.default('true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Cấu hình môi trường không hợp lệ:\n${lines.join('\n')}\nXem .env.example và sao chép thành .env.`,
    );
  }
  return result.data;
}
