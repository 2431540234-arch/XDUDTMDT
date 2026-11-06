// M02 – Xác thực: đăng ký, đăng nhập (khách / admin), refresh token xoay vòng, đăng xuất, quên & đặt lại mật khẩu bằng liên kết có token (gửi qua email).
import { createHash, randomBytes } from 'node:crypto';
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

export const VERIFY_EMAIL_TTL = '24h'; // liên kết xác thực email (JWT mục đích verify_email, DAC_TA D-T… #9)
export const VERIFY_RESEND_MS = 60_000;
export const RESET_TTL_MS = 30 * 60_000; // liên kết đặt lại mật khẩu sống 30 phút
export const RESET_RESEND_MS = 60_000; // tối thiểu 60 giây giữa hai lần gửi

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
    await this.sendVerificationEmail(created);
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

  // ------------------------------------------------------------ xác thực email (UC-AUTH-07, JWT verify_email, không thêm bảng)
  private readonly lastVerifyMail = new Map<number, number>();

  /** Khóa ký riêng cho token xác thực email để không dùng lẫn với access token */
  private verifySecret() {
    return `${this.config.get('JWT_ACCESS_SECRET')}:verify_email`;
  }

  /** Gửi email chứa liên kết xác thực (hạn 24 giờ). Lỗi gửi thư không làm hỏng luồng gọi nó */
  async sendVerificationEmail(u: { id: number; email: string; fullName: string }) {
    const token = await this.jwt.signAsync(
      { sub: u.id, email: u.email, purpose: 'verify_email' },
      { secret: this.verifySecret(), expiresIn: VERIFY_EMAIL_TTL },
    );
    const link = `${this.config.get('APP_URL').replace(/\/+$/, '')}/verify-email?token=${token}`;
    if (this.config.get('NODE_ENV') !== 'production')
      this.log.log(`Liên kết xác thực email cho ${u.email}: ${link}`);
    try {
      await this.mail.send({
        to: u.email,
        subject: 'Xác thực email – Aurelia Living',
        text: `Bấm vào liên kết để xác thực email (có hiệu lực 24 giờ): ${link}`,
        html: `<p>Xin chào ${u.fullName},</p><p>Vui lòng xác thực email để có thể đánh giá sản phẩm.</p><p><a href="${link}" style="background:#8B4A2B;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Xác thực email</a></p><p>Liên kết có hiệu lực trong 24 giờ.</p>`,
      });
    } catch (e) {
      this.log.warn(`Không gửi được email xác thực cho ${u.email}: ${(e as Error).message}`);
    }
  }

  async verifyEmail(raw: unknown) {
    const token = str(asBody(raw).token);
    const bad = () =>
      new AppException(ErrorCode.BAD_REQUEST, 'Liên kết xác thực không đúng hoặc đã hết hạn.');
    let payload: { sub?: number; email?: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.verifySecret() });
    } catch {
      throw bad();
    }
    if (payload.purpose !== 'verify_email' || !payload.sub) throw bad();
    const u = await this.prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null } });
    // đổi email sau khi gửi liên kết ⇒ liên kết cũ vô hiệu
    if (!u || u.email.toLowerCase() !== String(payload.email).toLowerCase()) throw bad();
    if (!u.emailVerifiedAt) {
      await this.prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date() } });
    }
    return { verified: true as const };
  }

  async resendVerification(userId: number) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!u) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED, 'Bạn chưa đăng nhập.');
    if (u.emailVerifiedAt) return { sent: false as const, verified: true as const };
    const last = this.lastVerifyMail.get(u.id);
    if (last && Date.now() - last < VERIFY_RESEND_MS) {
      const wait = Math.ceil((VERIFY_RESEND_MS - (Date.now() - last)) / 1000);
      throw new AppException(ErrorCode.RATE_LIMITED, `Vui lòng đợi ${wait} giây trước khi gửi lại email.`);
    }
    this.lastVerifyMail.set(u.id, Date.now());
    await this.sendVerificationEmail(u);
    return { sent: true as const, verified: false as const };
  }

  // ------------------------------------------------------------ quên / đặt lại mật khẩu (liên kết có token)
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
    if (last && Date.now() - last.createdAt.getTime() < RESET_RESEND_MS) {
      const wait = Math.ceil((RESET_RESEND_MS - (Date.now() - last.createdAt.getTime())) / 1000);
      throw new AppException(ErrorCode.RATE_LIMITED, `Vui lòng đợi ${wait} giây trước khi gửi lại email.`);
    }
    // token ngẫu nhiên 256 bit; DB chỉ lưu bản băm, token gốc chỉ nằm trong liên kết gửi qua email
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.passwordReset.updateMany({
        where: { userId: u.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordReset.create({
        data: { userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      }),
    ]);
    const link = `${this.config.get('APP_URL').replace(/\/+$/, '')}/reset-password?token=${token}`;
    // dev: in liên kết ra log (và xem email ở Mailpit); production chỉ gửi mail
    if (this.config.get('NODE_ENV') !== 'production')
      this.log.log(`Liên kết đặt lại mật khẩu cho ${email}: ${link}`);
    await this.mail.send({
      to: email,
      subject: 'Đặt lại mật khẩu – Aurelia Living',
      text: `Bấm vào liên kết để đặt lại mật khẩu (có hiệu lực 30 phút): ${link}`,
      html: `<p>Xin chào ${u.fullName},</p><p>Bấm vào nút bên dưới để đặt lại mật khẩu của bạn. Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.</p><p><a href="${link}" style="background:#8B4A2B;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Đặt lại mật khẩu</a></p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    });
    return { sent: true as const };
  }

  async resetPassword(raw: unknown) {
    const { token, password } = asBody(raw);
    const errs = new FieldErrors();
    if (str(password).length < 8) errs.add('password', 'Mật khẩu tối thiểu 8 ký tự.');
    if (!/^[0-9a-f]{64}$/.test(str(token))) errs.add('token', 'Liên kết không hợp lệ.');
    errs.throwIfAny();

    const rec = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(str(token)) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      throw new AppException(ErrorCode.BAD_REQUEST, 'Liên kết đặt lại mật khẩu không đúng hoặc đã hết hạn.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: rec.userId },
        data: { passwordHash: await hash(str(password), BCRYPT_COST) },
      }),
      this.prisma.passwordReset.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      // đặt lại mật khẩu ⇒ thu hồi mọi phiên cũ
      this.prisma.userSession.updateMany({
        where: { userId: rec.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return null;
  }
}
