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

  // local: đĩa cục bộ | minio: MinIO dev | s3: AWS S3 production (cùng mã, chỉ khác biến môi trường)
  STORAGE_DRIVER: z.enum(['local', 'minio', 's3']).default('minio'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  // local: URL API phục vụ thư mục upload. minio: URL công khai của bucket public (gồm tên bucket)
  STORAGE_PUBLIC_URL: z.string().default('http://localhost:9000/aurelia-public'),
  PRESIGN_EXPIRES_SECONDS: z.coerce.number().int().positive().default(900),

  // minio: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY bắt buộc (kiểm tra ở superRefine bên dưới).
  // s3: S3_ENDPOINT bỏ trống (SDK tự chọn theo S3_REGION); khóa truy cập bỏ trống thì SDK dùng IAM role.
  S3_ENDPOINT: optional(z.string().url()),
  // Endpoint mà TRÌNH DUYỆT gọi được (dùng ký presigned URL). Mặc định = S3_ENDPOINT.
  // Khác nhau khi API chạy trong Docker (S3_ENDPOINT=http://minio:9000, public=http://localhost:9000).
  S3_PUBLIC_ENDPOINT: optional(z.string().url()),
  // true: URL dạng /bucket/key (MinIO). false: dạng bucket.s3.amazonaws.com (S3). Mặc định: true với minio, false với s3.
  S3_FORCE_PATH_STYLE: optional(bool),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: optional(z.string()),
  S3_SECRET_KEY: optional(z.string()),
  S3_BUCKET_PUBLIC: z.string().default('aurelia-public'),
  S3_BUCKET_PRIVATE: z.string().default('aurelia-private'),

  UPLOAD_MAX_IMAGE_MB: z.coerce.number().positive().default(5),
  UPLOAD_MAX_MODEL_MB: z.coerce.number().positive().default(100),
  UPLOAD_MAX_PANORAMA_MB: z.coerce.number().positive().default(20),
  // NFR02: tệp LOD dùng cho web (do job model-processing sinh ra) không được lớn hơn ngưỡng này. Chưa có code kiểm tra (làm ở M12).
  MODEL_SERVE_MAX_MB: z.coerce.number().positive().default(5),

  // VNPay sandbox: tùy chọn cho tới khi làm module thanh toán
  VNPAY_TMN_CODE: optional(z.string()),
  VNPAY_HASH_SECRET: optional(z.string()),
  VNPAY_URL: optional(z.string().url()),
  VNPAY_RETURN_URL: optional(z.string().url()),
  VNPAY_IPN_URL: optional(z.string().url()),

  // queue: đẩy job vào hàng đợi `mail` (retry 3 lần, backoff mũ) | direct: gửi SMTP ngay trong request
  MAIL_TRANSPORT: z.enum(['direct', 'queue']).default('queue'),
  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('Aurelia Living <no-reply@aurelia.local>'),

  // Giới hạn tốc độ: mặc định cho mọi route, và nhóm `auth` chỉ áp dụng cho route gắn @AuthThrottle()
  THROTTLE_DEFAULT_LIMIT: z.coerce.number().int().positive().default(120),
  THROTTLE_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_AUTH_LIMIT: z.coerce.number().int().positive().default(10),
  THROTTLE_AUTH_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  // Cache Redis (CacheService)
  CACHE_ENABLED: bool.default('true'),
  CACHE_KEY_PREFIX: z.string().default('aurelia:cache:'),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  SWAGGER_ENABLED: bool.default('true'),
});

const MINIO_REQUIRED = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;

/** Có dùng path-style không: biến S3_FORCE_PATH_STYLE nếu đặt, nếu không thì true với MinIO, false với S3 */
export function resolveForcePathStyle(env: Pick<Env, 'STORAGE_DRIVER' | 'S3_FORCE_PATH_STYLE'>): boolean {
  return env.S3_FORCE_PATH_STYLE ?? env.STORAGE_DRIVER === 'minio';
}

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
