// M02 – Xác thực. Controller – UC-AUTH-01..07. Đăng nhập khách và admin dùng chung POST /auth/login (adminOnly).
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { AuthThrottle } from '../../common/decorators/throttle.decorators';
import { AuthService, type RequestMeta } from './auth.service';

const meta = (req: Request): RequestMeta => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('verify-email')
  @ApiOperation({ summary: 'Xác thực email bằng token trong liên kết: { token }' })
  verifyEmail(@Body() body: unknown) {
    return this.auth.verifyEmail(body);
  }

  @ApiBearerAuth()
  @AuthThrottle()
  @HttpCode(200)
  @Post('resend-verification')
  @ApiOperation({ summary: 'Gửi lại email xác thực cho tài khoản đang đăng nhập (cách nhau 60 giây)' })
  resendVerification(@CurrentUser('id') userId: number) {
    return this.auth.resendVerification(userId);
  }

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập (adminOnly=true cho trang quản trị)' })
  @ApiBody({
    schema: {
      example: { email: 'khachhang@aurelia.vn', password: '123456' },
      properties: { email: { type: 'string' }, password: { type: 'string' }, adminOnly: { type: 'boolean' } },
    },
  })
  login(@Body() body: unknown, @Req() req: Request) {
    return this.auth.login(body, meta(req));
  }

  @Public()
  @AuthThrottle()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản khách hàng' })
  @ApiBody({
    schema: {
      example: {
        fullName: 'Nguyễn Văn A',
        email: 'a@example.com',
        phone: '0912345678',
        password: 'matkhau123',
      },
    },
  })
  register(@Body() body: unknown, @Req() req: Request) {
    return this.auth.register(body, meta(req));
  }

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({ summary: 'Đổi refresh token lấy cặp token mới (xoay vòng)' })
  @ApiBody({ schema: { example: { refreshToken: '<refreshToken>' } } })
  refresh(@Body() body: unknown, @Req() req: Request) {
    return this.auth.refresh(body, meta(req));
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất (thu hồi refresh token)' })
  logout(@CurrentUser('id') userId: number | undefined, @Body() body: unknown) {
    return this.auth.logout(userId, body);
  }

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Gửi OTP 6 số (hết hạn 5 phút, gửi lại sau 60 giây)' })
  @ApiBody({ schema: { example: { email: 'khachhang@aurelia.vn' } } })
  forgotPassword(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng OTP (tối đa 5 lần thử)' })
  @ApiBody({ schema: { example: { email: 'khachhang@aurelia.vn', otp: '123456', password: 'matkhaumoi1' } } })
  resetPassword(@Body() body: unknown) {
    return this.auth.resetPassword(body);
  }

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('google')
  @ApiOperation({ summary: 'Đăng nhập Google (cần GOOGLE_CLIENT_ID/SECRET)' })
  google() {
    return this.auth.google();
  }
}
