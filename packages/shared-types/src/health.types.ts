// Response của GET /health
export type CheckStatus = 'up' | 'down';

export interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export interface HealthStatus {
  status: 'ok';
  /** Số giây tiến trình đã chạy. */
  uptime: number;
  /** Thời điểm kiểm tra, ISO 8601 UTC. */
  timestamp: string;
  checks: {
    database: CheckStatus;
    redis: CheckStatus;
    /** MinIO (dev) hoặc S3 (production): hai bucket truy cập được */
    storage: CheckStatus;
    /** SMTP (Mailpit khi dev) */
    smtp: CheckStatus;
    /** BullMQ: đọc được trạng thái các hàng đợi */
    queues: CheckStatus;
  };
  /** Số job theo trạng thái của từng hàng đợi (model-processing, image-processing, mail, notification) */
  queues: Record<string, QueueCounts>;
}
