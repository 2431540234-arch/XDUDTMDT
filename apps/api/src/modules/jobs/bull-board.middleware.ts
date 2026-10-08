// Bảo vệ Bull Board (/admin/queues): chỉ admin. Chấp nhận Bearer, cookie bq_token, hoặc ?token= (lần đầu, rồi đặt cookie
// để các tài nguyên tĩnh của giao diện tự mang token). Bull Board là route Express, không đi qua guard của Nest.
import { verify } from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

const COOKIE = 'bq_token';

function readCookie(header: string | undefined): string | undefined {
  return header
    ?.split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
}

export function bullBoardAdminOnly(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = bearer ?? queryToken ?? readCookie(req.headers.cookie);

  try {
    if (token) {
      const payload = verify(token, process.env.JWT_ACCESS_SECRET as string) as { roles?: string[] };
      if (payload.roles?.includes('admin')) {
        if (queryToken)
          res.setHeader(
            'Set-Cookie',
            `${COOKIE}=${queryToken}; HttpOnly; Path=/admin/queues; SameSite=Strict`,
          );
        return next();
      }
      return void res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Chỉ quản trị viên được xem hàng đợi.' },
      });
    }
  } catch {
    // token sai hoặc hết hạn: rơi xuống 401
  }
  res.status(401).json({
    success: false,
    error: { code: 'AUTH_UNAUTHENTICATED', message: 'Cần đăng nhập quản trị (Bearer hoặc ?token=).' },
  });
}
