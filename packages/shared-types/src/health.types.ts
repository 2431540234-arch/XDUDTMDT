// Response của GET /health
export interface HealthStatus {
  status: 'ok';
  /** Số giây tiến trình đã chạy. */
  uptime: number;
  /** Thời điểm kiểm tra, ISO 8601 UTC. */
  timestamp: string;
  checks: {
    database: 'up';
  };
}
