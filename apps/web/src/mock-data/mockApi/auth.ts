// Mock API: xác thực, hồ sơ, địa chỉ
import { nextId } from '../db';
import {
  ApiFail,
  created,
  done,
  nowIso,
  ok,
  notFound,
  validation,
  type Ctx,
  type DbUser,
  type Result,
} from './http';
import { addressView, mediaPath, userView } from './views';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^0\d{9}$/;

export function sessionUser(ctx: Ctx, u: DbUser) {
  const roles = ctx.db.userRoles
    .filter((r) => r.userId === u.id)
    .map((r) => ctx.db.roles.find((x) => x.id === r.roleId)!.code as 'admin' | 'user');
  return {
    id: u.id,
    uuid: u.uuid,
    email: u.email,
    fullName: u.fullName,
    status: u.status,
    roles,
    avatarUrl: mediaPath(ctx.db, u.avatarMediaId),
    phone: u.phone,
  };
}

const tokensFor = (u: DbUser) => ({
  accessToken: `mock.${u.id}.${Date.now()}`,
  refreshToken: `mock-refresh.${u.id}.${Date.now()}`,
});

export function login(ctx: Ctx): Result {
  const { email = '', password = '', adminOnly = false } = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (!emailRe.test(String(email))) errs.email = 'Email không hợp lệ.';
  if (!password) errs.password = 'Vui lòng nhập mật khẩu.';
  if (Object.keys(errs).length) throw validation(errs);
  const u = ctx.db.users.find(
    (x) => x.email.toLowerCase() === String(email).trim().toLowerCase() && !x.deletedAt,
  );
  if (!u || ctx.db.credentials[u.id] !== password)
    throw new ApiFail('AUTH_INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  if (u.status !== 'active')
    throw new ApiFail('AUTH_ACCOUNT_LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ cửa hàng.');
  const su = sessionUser(ctx, u);
  if (adminOnly && !su.roles.includes('admin'))
    throw new ApiFail('FORBIDDEN', 'Tài khoản không có quyền quản trị.');
  u.lastLoginAt = nowIso();
  return ok({ user: su, tokens: tokensFor(u) });
}

export function register(ctx: Ctx): Result {
  const { fullName = '', email = '', phone = '', password = '' } = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (String(fullName).trim().length < 2) errs.fullName = 'Vui lòng nhập họ và tên.';
  if (!emailRe.test(String(email))) errs.email = 'Email không hợp lệ.';
  if (!phoneRe.test(String(phone))) errs.phone = 'Số điện thoại phải gồm 10 chữ số.';
  if (String(password).length < 8) errs.password = 'Mật khẩu tối thiểu 8 ký tự.';
  if (Object.keys(errs).length) throw validation(errs);
  if (ctx.db.users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase()))
    throw new ApiFail('EMAIL_ALREADY_EXISTS', 'Email này đã được đăng ký.');
  const id = nextId(ctx.db.users);
  const at = nowIso();
  const u: DbUser = {
    id,
    uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    fullName: String(fullName).trim(),
    email: String(email).trim().toLowerCase(),
    phone,
    avatarMediaId: null,
    status: 'active',
    emailVerifiedAt: null,
    lastLoginAt: at,
    deletedAt: null,
    createdAt: at,
    updatedAt: at,
  };
  ctx.db.users.push(u);
  ctx.db.userRoles.push({ userId: id, roleId: 2, createdAt: at });
  ctx.db.userProfiles.push({ userId: id, gender: null, birthday: null, loyaltyPoints: 0, adminNote: null });
  ctx.db.credentials[id] = password;
  ctx.db.carts.push({ id: nextId(ctx.db.carts), userId: id, createdAt: at, updatedAt: at });
  ctx.db.activityLogs.push({
    id: nextId(ctx.db.activityLogs),
    actorId: id,
    action: 'user.register',
    targetType: 'user',
    targetId: id,
    changes: null,
    ipAddress: '127.0.0.1',
    createdAt: at,
  });
  return created({ user: sessionUser(ctx, u), tokens: tokensFor(u) });
}

export function refresh(ctx: Ctx): Result {
  const rt = String(ctx.body?.refreshToken ?? '');
  const id = Number(/^mock-refresh\.(\d+)\./.exec(rt)?.[1]);
  const u = ctx.db.users.find((x) => x.id === id);
  if (!u) throw new ApiFail('AUTH_TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ.');
  return ok({ user: sessionUser(ctx, u), tokens: tokensFor(u) });
}

/** Mock không gửi email: trả kèm liên kết xác thực để thử (chỉ có ở mock) */
export function resendVerification(ctx: Ctx): Result {
  const u = ctx.user!;
  if (u.emailVerifiedAt) return ok({ sent: false, verified: true });
  return ok({ sent: true, verified: false, devVerifyLink: `/verify-email?token=mock.${u.id}` });
}

export function verifyEmail(ctx: Ctx): Result {
  const id = Number(/^mock\.(\d+)$/.exec(String(ctx.body?.token ?? ''))?.[1]);
  const u = ctx.db.users.find((x) => x.id === id);
  if (!u) throw new ApiFail('BAD_REQUEST', 'Liên kết xác thực không đúng hoặc đã hết hạn.');
  u.emailVerifiedAt ??= nowIso();
  return ok({ verified: true });
}

export function forgotPassword(ctx: Ctx): Result {
  const email = String(ctx.body?.email ?? '')
    .trim()
    .toLowerCase();
  if (!emailRe.test(email)) throw validation({ email: 'Email không hợp lệ.' });
  // Không tiết lộ email có tồn tại hay không. Mock không gửi email thật nên trả kèm liên kết để thử (chỉ có ở mock).
  const token = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  ctx.db.resetTokens[token] = { email, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() };
  return ok({ sent: true, devResetLink: `/reset-password?token=${token}` });
}

export function resetPassword(ctx: Ctx): Result {
  const { token = '', password = '' } = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (String(password).length < 8) errs.password = 'Mật khẩu tối thiểu 8 ký tự.';
  if (!/^[0-9a-f]{64}$/.test(String(token))) errs.token = 'Liên kết không hợp lệ.';
  if (Object.keys(errs).length) throw validation(errs);
  const rec = ctx.db.resetTokens[String(token)];
  if (!rec || new Date(rec.expiresAt) < new Date())
    throw new ApiFail('BAD_REQUEST', 'Liên kết đặt lại mật khẩu không đúng hoặc đã hết hạn.');
  const u = ctx.db.users.find((x) => x.email.toLowerCase() === rec.email);
  if (!u) throw notFound('Tài khoản');
  ctx.db.credentials[u.id] = password;
  delete ctx.db.resetTokens[String(token)];
  return done();
}

export function googleLogin(ctx: Ctx): Result {
  const u = ctx.db.users.find((x) => x.email === 'khachhang@aurelia.vn')!;
  return ok({ user: sessionUser(ctx, u), tokens: tokensFor(u) });
}

export const me = (ctx: Ctx): Result => ok(userView(ctx.db, ctx.user!));

export function updateMe(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const u = ctx.user!;
  const errs: Record<string, string> = {};
  if (b.fullName !== undefined && String(b.fullName).trim().length < 2)
    errs.fullName = 'Vui lòng nhập họ và tên.';
  if (b.phone && !phoneRe.test(String(b.phone))) errs.phone = 'Số điện thoại phải gồm 10 chữ số.';
  if (Object.keys(errs).length) throw validation(errs);
  if (b.fullName !== undefined) u.fullName = String(b.fullName).trim();
  if (b.phone !== undefined) u.phone = b.phone || null;
  const p = ctx.db.userProfiles.find((x) => x.userId === u.id);
  if (p) {
    if (b.gender !== undefined) p.gender = b.gender;
    if (b.birthday !== undefined) p.birthday = b.birthday || null;
  }
  if (b.avatarUrl) {
    const id = nextId(ctx.db.media);
    ctx.db.media.push({
      id,
      fileName: `avatar-${u.id}.png`,
      filePath: String(b.avatarUrl),
      mimeType: 'image/png',
      fileSize: String(b.avatarUrl).length,
      altText: u.fullName,
      uploadedBy: u.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    u.avatarMediaId = id;
  }
  u.updatedAt = nowIso();
  return ok(userView(ctx.db, u));
}

export function changePassword(ctx: Ctx): Result {
  const { currentPassword = '', newPassword = '' } = ctx.body ?? {};
  const u = ctx.user!;
  const errs: Record<string, string> = {};
  if (ctx.db.credentials[u.id] !== currentPassword) errs.currentPassword = 'Mật khẩu hiện tại không đúng.';
  if (String(newPassword).length < 8) errs.newPassword = 'Mật khẩu mới tối thiểu 8 ký tự.';
  else if (newPassword === currentPassword) errs.newPassword = 'Mật khẩu mới phải khác mật khẩu cũ.';
  if (Object.keys(errs).length) throw validation(errs);
  ctx.db.credentials[u.id] = newPassword;
  return done();
}

// ---------------- Địa chỉ ----------------
export const listAddresses = (ctx: Ctx): Result =>
  ok(
    ctx.db.addresses
      .filter((a) => a.userId === ctx.user!.id)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id - b.id)
      .map((a) => addressView(ctx.db, a)),
  );

function validateAddress(b: Record<string, unknown>) {
  const errs: Record<string, string> = {};
  if (String(b.recipientName ?? '').trim().length < 2) errs.recipientName = 'Vui lòng nhập tên người nhận.';
  if (!phoneRe.test(String(b.phone ?? ''))) errs.phone = 'Số điện thoại phải gồm 10 chữ số.';
  if (!String(b.province ?? '').trim()) errs.province = 'Vui lòng chọn tỉnh/thành.';
  if (!String(b.district ?? '').trim()) errs.district = 'Vui lòng nhập quận/huyện.';
  if (!String(b.ward ?? '').trim()) errs.ward = 'Vui lòng nhập phường/xã.';
  if (!String(b.addressLine ?? '').trim()) errs.addressLine = 'Vui lòng nhập số nhà, tên đường.';
  if (Object.keys(errs).length) throw validation(errs);
}

export function createAddress(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  validateAddress(b);
  const mine = ctx.db.addresses.filter((a) => a.userId === ctx.user!.id);
  const id = nextId(ctx.db.addresses);
  const at = nowIso();
  const isDefault = mine.length === 0 || Boolean(b.isDefault);
  if (isDefault) mine.forEach((a) => (a.isDefault = false));
  const row = {
    id,
    userId: ctx.user!.id,
    recipientName: String(b.recipientName).trim(),
    phone: String(b.phone),
    province: String(b.province),
    district: String(b.district),
    ward: String(b.ward),
    addressLine: String(b.addressLine),
    isDefault,
    createdAt: at,
    updatedAt: at,
  };
  ctx.db.addresses.push(row);
  ctx.db.addressLabels[id] = String(b.label || 'Địa chỉ khác');
  return created(addressView(ctx.db, row));
}

function ownAddress(ctx: Ctx) {
  const a = ctx.db.addresses.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user!.id);
  if (!a) throw notFound('Địa chỉ');
  return a;
}

export function updateAddress(ctx: Ctx): Result {
  const a = ownAddress(ctx);
  const b = { ...a, ...ctx.body };
  validateAddress(b);
  Object.assign(a, {
    recipientName: b.recipientName,
    phone: b.phone,
    province: b.province,
    district: b.district,
    ward: b.ward,
    addressLine: b.addressLine,
    updatedAt: nowIso(),
  });
  if (ctx.body?.label) ctx.db.addressLabels[a.id] = String(ctx.body.label);
  if (ctx.body?.isDefault) {
    ctx.db.addresses.filter((x) => x.userId === a.userId).forEach((x) => (x.isDefault = x.id === a.id));
  }
  return ok(addressView(ctx.db, a));
}

export function deleteAddress(ctx: Ctx): Result {
  const a = ownAddress(ctx);
  ctx.db.addresses.splice(ctx.db.addresses.indexOf(a), 1);
  if (a.isDefault) {
    // xóa địa chỉ mặc định ⇒ địa chỉ MỚI NHẤT còn lại (id lớn nhất) thành mặc định; xóa hết cũng hợp lệ
    const rest = ctx.db.addresses.filter((x) => x.userId === a.userId);
    const newest = rest.reduce<(typeof rest)[number] | undefined>(
      (m, x) => (!m || x.id > m.id ? x : m),
      undefined,
    );
    if (newest) newest.isDefault = true;
  }
  return done();
}

export function setDefaultAddress(ctx: Ctx): Result {
  const a = ownAddress(ctx);
  ctx.db.addresses.filter((x) => x.userId === a.userId).forEach((x) => (x.isDefault = x.id === a.id));
  return ok(addressView(ctx.db, a));
}
