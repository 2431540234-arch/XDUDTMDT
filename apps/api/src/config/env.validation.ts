// Kiểm tra biến môi trường khi khởi động. Thiếu/sai -> dừng ngay với thông báo rõ ràng, không chạy nửa vời.
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
// Biến tùy chọn: chuỗi rỗng trong .env được coi như chưa đặt
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

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

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  STORAGE_DRIVER: z.enum(['local', 'minio']).default('minio'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  // local: URL API phục vụ thư mục upload. minio: URL công khai của bucket public (gồm tên bucket)
  STORAGE_PUBLIC_URL: z.string().default('http://localhost:9000/aurelia-public'),
  PRESIGN_EXPIRES_SECONDS: z.coerce.number().int().positive().default(900),

  // Bắt buộc khi STORAGE_DRIVER=minio (kiểm tra ở superRefine bên dưới)
  S3_ENDPOINT: optional(z.string().url()),
  // Endpoint mà TRÌNH DUYỆT gọi được (dùng ký presigned URL). Mặc định = S3_ENDPOINT.
  // Khác nhau khi API chạy trong Docker (S3_ENDPOINT=http://minio:9000, public=http://localhost:9000).
  S3_PUBLIC_ENDPOINT: optional(z.string().url()),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: optional(z.string()),
  S3_SECRET_KEY: optional(z.string()),
  S3_BUCKET_PUBLIC: z.string().default('aurelia-public'),
  S3_BUCKET_PRIVATE: z.string().default('aurelia-private'),

  UPLOAD_MAX_IMAGE_MB: z.coerce.number().positive().default(5),
  UPLOAD_MAX_MODEL_MB: z.coerce.number().positive().default(100),
  UPLOAD_MAX_PANORAMA_MB: z.coerce.number().positive().default(20),

  // VNPay sandbox: tùy chọn cho tới khi làm module thanh toán
  VNPAY_TMN_CODE: optional(z.string()),
  VNPAY_HASH_SECRET: optional(z.string()),
  VNPAY_URL: optional(z.string().url()),
  VNPAY_RETURN_URL: optional(z.string().url()),
  VNPAY_IPN_URL: optional(z.string().url()),

  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('Aurelia Living <no-reply@aurelia.local>'),

  SWAGGER_ENABLED: bool.default('true'),
});

const MINIO_REQUIRED = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;

const envSchemaChecked = envSchema.superRefine((env, ctx) => {
  if (env.STORAGE_DRIVER !== 'minio') return;
  for (const key of MINIO_REQUIRED) {
    if (!env[key]) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'bắt buộc khi STORAGE_DRIVER=minio' });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchemaChecked.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Cấu hình môi trường không hợp lệ:\n${lines.join('\n')}\nXem .env.example và sao chép thành .env.`,
    );
  }
  return result.data;
}
