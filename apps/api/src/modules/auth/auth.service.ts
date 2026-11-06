// M02 – Xác thực: đăng ký, đăng nhập (khách / admin), refresh token xoay vòng, đăng xuất, quên & đặt lại mật khẩu bằng OTP.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compare, hash, hashSync } from 'bcryptjs';
import { ErrorCode, type RoleCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { EMAIL_RE, FieldErrors, PHONE_RE, asBody, str } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { AppConfig } from '../../config/app-config.service';
import { MAIL_SERVICE, type MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BCRYPT_COST } from '../users/users.service';

const USER_INCLUDE = {
  userRoles: { include: { role: true } },
  avatarMedia: true,
} satisfies Prisma.UserInclude;
type UserWithRoles = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_MS = 60_000;
export const OTP_MAX_ATTEMPTS = 5;

// Băm giả để thời gian so sánh mật khẩu như nhau dù email không tồn tại
const DUMMY_HASH = hashSync('khong-ton-tai', BCRYPT_COST);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly views: CatalogViews,
    @Inject(MAIL_SERVICE) private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------ token
  private ttlMs(spec: string): number {
    const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(spec.trim());
    if (!m) return 7 * 86_400_000;
    const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] ?? 's']!;
    return Number(m[1]) * unit;
  }

  private sessionUser(u: UserWithRoles) {
    return {
      id: u.id,
      uuid: u.uuid,
      email: u.email,
      fullName: u.fullName,
      status: u.status,
      roles: u.userRoles.map((r) => r.role.code as RoleCode),
      avatarUrl: this.views.url(u.avatarMedia?.filePath),
      phone: u.phone,
    };
  }

  /** Cặp token: access JWT ngắn hạn + refresh ngẫu nhiên (chỉ lưu hash trong user_sessions) */
  private async issueTokens(u: UserWithRoles, meta: RequestMeta) {
    const roles = u.userRoles.map((r) => r.role.code as RoleCode);
    const accessToken = await this.jwt.signAsync(
      { sub: u.id, roles },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.userSession.create({
      data: {
        userId: u.id,
        refreshTokenHash: this.refreshHash(refreshToken),
        ipAddress: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
        expiresAt: new Date(Date.now() + this.ttlMs(this.config.get('JWT_REFRESH_EXPIRES_IN'))),
      },
    });
    return { accessToken, refreshToken };
  }

  private refreshHash(token: string) {
    return sha256(`${this.config.get('JWT_REFRESH_SECRET')}:${token}`);
  }

  private findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
      include: USER_INCLUDE,
    });
  }

  // ------------------------------------------------------------ đăng nhập / đăng ký
  async login(raw: unknown, meta: RequestMeta) {
    const { email, password, adminOnly } = asBody(raw);
    const errs = new FieldErrors();
    if (!EMAIL_RE.test(str(email))) errs.add('email', 'Email không hợp lệ.');
    if (!str(password)) errs.add('password', 'Vui lòng nhập mật khẩu.');
    errs.throwIfAny();

    const u = await this.findByEmail(str(email));
    // so sánh hash kể cả khi không có user để thời gian phản hồi không lộ email có tồn tại hay không
    const ok = await compare(str(password), u?.passwordHash ?? DUMMY_HASH);
    if (!u || !ok)
      throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Email hoặc mật khẩu không đúng.');
    if (u.status !== 'active') {
      throw new AppException(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ cửa hàng.',
      );
    }
    const su = this.sessionUser(u);
    if (adminOnly && !su.roles.includes('admin')) {
      throw new AppException(ErrorCode.FORBIDDEN, 'Tài khoản không có quyền quản trị.');
    }
    await this.prisma.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
    return { user: su, tokens: await this.issueTokens(u, meta) };
  }

  async register(raw: unknown, meta: RequestMeta) {
    const { fullName, email, phone, password } = asBody(raw);
    const errs = new FieldErrors();
    if (str(fullName).trim().length < 2) errs.add('fullName', 'Vui lòng nhập họ và tên.');
    if (!EMAIL_RE.test(str(email))) errs.add('email', 'Email không hợp lệ.');
    if (!PHONE_RE.test(str(phone))) errs.add('phone', 'Số điện thoại phải gồm 10 chữ số.');
    if (str(password).length < 8) errs.add('password', 'Mật khẩu tối thiểu 8 ký tự.');
    errs.throwIfAny();

    const normalized = str(email).trim().toLowerCase();
    if (await this.findByEmail(normalized)) {
      throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS, 'Email này đã được đăng ký.');
    }
    const passwordHash = await hash(str(password), BCRYPT_COST);
    let created: UserWithRoles;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.findUniqueOrThrow({ where: { code: 'user' } });
        const u = await tx.user.create({
          data: {
            fullName: str(fullName).trim(),
            email: normalized,
            phone: str(phone),
            passwordHash,
            lastLoginAt: new Date(),
            userRoles: { create: { roleId: role.id } },
            cart: { create: {} },
          },
          include: USER_INCLUDE,
        });
        await tx.activityLog.create({
          data: {
            actorId: u.id,
            action: 'user.register',
            targetType: 'user',
            targetId: u.id,
            ipAddress: meta.ip,
          },
        });
        return u;
      });
    } catch (e) {
      // đăng ký đồng thời cùng email: ràng buộc duy nhất của DB chặn bản thứ hai
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS, 'Email này đã được đăng ký.');
      }
      throw e;
    }
    return { user: this.sessionUser(created), tokens: await this.issueTokens(created, meta) };
  }

  /** Đăng nhập Google: cần GOOGLE_CLIENT_ID/SECRET; chưa cấu hình thì báo rõ ràng, không ảnh hưởng luồng khác */
  google() {
    if (!this.config.get('GOOGLE_CLIENT_ID') || !this.config.get('GOOGLE_CLIENT_SECRET')) {
      throw new AppException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Đăng nhập bằng Google chưa được cấu hình. Vui lòng đăng nhập bằng email.',
      );
    }
    throw new AppException(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Đăng nhập bằng Google đang được hoàn thiện. Vui lòng đăng nhập bằng email.',
    );
  }

  // ------------------------------------------------------------ refresh / logout
  /** Xoay vòng: refresh token cũ bị thu hồi, cấp cặp mới. Dùng lại token đã thu hồi ⇒ thu hồi mọi phiên của user. */
  async refresh(raw: unknown, meta: RequestMeta) {
    const token = str(asBody(raw).refreshToken);
    if (!token) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID, 'Phiên đăng nhập không hợp lệ.');
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: this.refreshHash(token) },
    });
    if (!session) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID, 'Phiên đăng nhập không hợp lệ.');
    if (session.revokedAt) {
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID, 'Phiên đăng nhập không hợp lệ.');
    }
    if (session.expiresAt < new Date()) {
      throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED, 'Phiên đăng nhập đã hết hạn.');
    }
    const u = await this.prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
      include: USER_INCLUDE,
    });
    if (!u || u.status !== 'active') {
      throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED, 'Tài khoản của bạn đang bị khóa.');
    }
    await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return { user: this.sessionUser(u), tokens: await this.issueTokens(u, meta) };
  }

  async logout(userId: number | undefined, raw: unknown) {
    const token = str(asBody(raw).refreshToken);
    if (token) {
      await this.prisma.userSession.updateMany({
        where: { refreshTokenHash: this.refreshHash(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      // FE không gửi refresh token: đăng xuất thu hồi mọi phiên làm mới của người dùng này
      await this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return null;
  }

  // ------------------------------------------------------------ quên / đặt lại mật khẩu (OTP)
  private newOtp(): string {
    return this.config.get('OTP_FIXED_CODE') ?? String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async forgotPassword(raw: unknown) {
    const email = str(asBody(raw).email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) new FieldErrors().add('email', 'Email không hợp lệ.').throwIfAny();
    const u = await this.findByEmail(email);
    // Không tiết lộ email có tồn tại hay không: luôn trả { sent: true }
    if (!u || u.status !== 'active') return { sent: true as const };

    const last = await this.prisma.passwordReset.findFirst({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
    });
    const sentAt = last?.lastSentAt ?? last?.createdAt;
    if (sentAt && Date.now() - sentAt.getTime() < OTP_RESEND_MS) {
      const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - sentAt.getTime())) / 1000);
      throw new AppException(ErrorCode.RATE_LIMITED, `Vui lòng đợi ${wait} giây trước khi gửi lại mã.`);
    }
    const otp = this.newOtp();
    await this.prisma.$transaction([
      this.prisma.passwordReset.updateMany({
        where: { userId: u.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordReset.create({
        data: {
          userId: u.id,
          tokenHash: sha256(randomBytes(32).toString('hex')),
          otpHash: sha256(`${u.id}:${otp}`),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
          lastSentAt: new Date(),
        },
      }),
    ]);
    // dev: in OTP ra log (và Mailpit) để thử nghiệm; production chỉ gửi mail
    if (this.config.get('NODE_ENV') !== 'production')
      this.log.log(`OTP đặt lại mật khẩu cho ${email}: ${otp}`);
    await this.mail.send({
      to: email,
      subject: 'Mã xác nhận đặt lại mật khẩu – Aurelia Living',
      text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
      html: `<p>Xin chào ${u.fullName},</p><p>Mã OTP đặt lại mật khẩu của bạn là <b style="font-size:20px">${otp}</b>.</p><p>Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    });
    return { sent: true as const };
  }

  async resetPassword(raw: unknown) {
    const { email, otp, password } = asBody(raw);
    const errs = new FieldErrors();
    if (str(password).length < 8) errs.add('password', 'Mật khẩu tối thiểu 8 ký tự.');
    if (!/^\d{6}$/.test(str(otp))) errs.add('otp', 'Vui lòng nhập đủ 6 số của mã OTP.');
    errs.throwIfAny();

    const bad = () => new AppException(ErrorCode.BAD_REQUEST, 'Mã OTP không đúng hoặc đã hết hạn.');
    const u = await this.findByEmail(str(email));
    if (!u) throw bad();
    const rec = await this.prisma.passwordReset.findFirst({
      where: { userId: u.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!rec || rec.expiresAt < new Date() || rec.attempts >= OTP_MAX_ATTEMPTS) throw bad();
    if (rec.otpHash !== sha256(`${u.id}:${str(otp)}`)) {
      await this.prisma.passwordReset.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
      throw bad();
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: await hash(str(password), BCRYPT_COST) },
      }),
      this.prisma.passwordReset.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      // đặt lại mật khẩu ⇒ thu hồi mọi phiên cũ
      this.prisma.userSession.updateMany({
        where: { userId: u.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return null;
  }
}
