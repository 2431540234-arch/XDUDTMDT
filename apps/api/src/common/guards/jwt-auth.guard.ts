// Guard toàn cục: mọi route cần access token hợp lệ, trừ route gắn @Public().
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ErrorCode, type RoleCode } from '@aurelia-living/shared-types';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { IS_PUBLIC_KEY, type RequestUser } from '../decorators/auth.decorators';
import { AppException } from '../exceptions/app.exception';

export interface AccessTokenPayload {
  sub: number;
  roles: RoleCode[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED, 'Bạn chưa đăng nhập.');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      req.user = { id: payload.sub, roles: payload.roles ?? [] };
      return true;
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED, 'Phiên đăng nhập đã hết hạn.');
      }
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID, 'Phiên đăng nhập không hợp lệ.');
    }
  }
}
