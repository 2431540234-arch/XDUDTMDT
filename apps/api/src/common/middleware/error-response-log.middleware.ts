// Ghi log mọi response ≥ 400 (method, đường dẫn, status, mã lỗi) ra tệp khi đặt HTTP_ERROR_LOG_FILE.
// Chỉ dùng khi điều tra test e2e (scripts/e2e-real.mjs bật): giúp phân biệt 429/403/409... với lỗi giao diện.
import { appendFileSync } from 'node:fs';
import type { NextFunction, Request, Response } from 'express';

export function errorResponseLog(file: string) {
  return (req: Request & { id?: string }, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode < 400) return;
      const line = JSON.stringify({
        at: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        code: (res.locals as { errorCode?: string }).errorCode ?? null,
        requestId: req.id ?? null,
      });
      try {
        appendFileSync(file, `${line}\n`);
      } catch {
        // không để lỗi ghi log làm hỏng request
      }
    });
    next();
  };
}
