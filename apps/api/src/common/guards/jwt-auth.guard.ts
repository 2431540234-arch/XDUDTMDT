// Guard toàn cục: mọi route cần access token hợp lệ, trừ route gắn @Public().
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ErrorCode, type RoleCode } from '@aurelia-living/shared-types';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY, type RequestUser } from '../decorators/auth.decorators';
import { AppException } from '../exceptions/app.exception';

export interface AccessTokenPayload {
  sub: number;
  /** id phiên (user_sessions) phát hành token này */
  sid?: number;
  roles: RoleCode[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    if (isPublic) {
      // Route công khai vẫn nhận diện người dùng nếu có token hợp lệ (ví dụ isWishlisted); token sai thì coi như khách
      const [sch, tok] = req.headers.authorization?.split(' ') ?? [];
      if (sch === 'Bearer' && tok) {
        try {
          const payload = await this.jwt.verifyAsync<AccessTokenPayload>(tok, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
          });
          req.user = { id: payload.sub, roles: payload.roles ?? [], sessionId: payload.sid };
        } catch {
          /* bỏ qua: khách vãng lai */
        }
      }
      return true;
    }

    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED, 'Bạn chưa đăng nhập.');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      req.user = { id: payload.sub, roles: payload.roles ?? [], sessionId: payload.sid };
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED, 'Phiên đăng nhập đã hết hạn.');
      }
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID, 'Phiên đăng nhập không hợp lệ.');
    }

    // Mỗi request đọc trạng thái HIỆN TẠI từ DB bằng MỘT truy vấn (không tin vai trò/phiên đóng băng trong JWT):
    //  • khóa/xóa tài khoản có hiệu lực NGAY, kể cả với access token còn hạn;
    //  • vai trò lấy từ user_roles: gán/gỡ admin có hiệu lực ở request kế tiếp (Roles/PermissionsGuard dùng req.user.roles này);
    //  • token mang sid (id phiên) mà phiên đã bị thu hồi/hết hạn (đăng xuất thiết bị từ xa, đăng xuất, đổi mật khẩu…) ⇒ 401.
    // Token cũ không có sid thì bỏ qua kiểm tra phiên.
    const sid = req.user!.sessionId;
    const u = await this.prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        status: true,
        deletedAt: true,
        userRoles: { select: { role: { select: { code: true } } } },
        ...(sid
          ? { userSessions: { where: { id: sid }, select: { revokedAt: true, expiresAt: true } } }
          : {}),
      },
    });
    if (!u || u.deletedAt)
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID, 'Phiên đăng nhập không hợp lệ.');
    if (u.status !== 'active') {
      throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED, 'Tài khoản của bạn đang bị khóa.');
    }
    if (sid) {
      const session = (u as { userSessions?: Array<{ revokedAt: Date | null; expiresAt: Date }> })
        .userSessions?.[0];
      if (!session || session.revokedAt || session.expiresAt < new Date())
        throw new AppException(
          ErrorCode.AUTH_TOKEN_INVALID,
          'Phiên đăng nhập đã bị đăng xuất. Vui lòng đăng nhập lại.',
        );
    }
    req.user!.roles = u.userRoles.map((r) => r.role.code as RoleCode);
    return true;
  }
}
