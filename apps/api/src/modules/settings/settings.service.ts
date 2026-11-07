// UC-ADM-03 – Cài đặt hệ thống: đọc/sửa bảng settings (key → JSONB). Chỉ các khóa trong danh sách cho phép, kiểm tra kiểu theo
// từng khóa (sai khóa/kiểu ⇒ 400). Mỗi thay đổi ghi activity_logs (trước/sau). Cài đặt công khai: GET /settings/public (content).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { EMAIL_RE, FieldErrors, asBody, str } from '../../common/utils/validate';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

type Json = Prisma.InputJsonValue;
const PAYMENT_METHODS = ['cod', 'bank_transfer', 'vnpay', 'momo', 'zalopay', 'card'];

/** Khóa đơn giản (spec UC-ADM-03): tên website, liên hệ, tiền tệ, phí vận chuyển mặc định, ngưỡng miễn phí, bật AR, bảo trì */
const GENERAL_KEYS = [
  'site_name',
  'contact_email',
  'contact_phone',
  'currency',
  'default_shipping_fee',
  'free_shipping_threshold',
  'ar_enabled',
  'maintenance_mode',
] as const;
/** Khóa cấu trúc dùng cho trang Cài đặt của FE */
const STRUCT_KEYS = ['store', 'payments', 'shippingZones'] as const;
export const SETTING_KEYS: readonly string[] = [...GENERAL_KEYS, ...STRUCT_KEYS];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly ingest: MediaIngestService,
    private readonly views: CatalogViews,
  ) {}

  private async valueOf(key: string): Promise<unknown> {
    return (await this.prisma.setting.findUnique({ where: { key } }))?.value ?? null;
  }

  /** Dạng cho trang Cài đặt của FE: { store, payments, shippingZones } + `general` (các khóa đơn giản của đặc tả) */
  async view() {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
    const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
    return {
      store: get('store'),
      payments: get('payments') ?? [],
      shippingZones: get('shippingZones') ?? [],
      general: Object.fromEntries(GENERAL_KEYS.map((k) => [k, get(k)])),
    };
  }

  // ---------------------------------------------------------------- kiểm tra kiểu theo khóa
  private num(v: unknown, field: string, errs: FieldErrors, min = 0): number {
    const n = typeof v === 'number' ? v : Number(str(v));
    if (!Number.isFinite(n) || n < min || n > 1_000_000_000) errs.add(field, 'Giá trị phải là số không âm.');
    return Math.round(n);
  }

  private async store(v: unknown, errs: FieldErrors): Promise<Json> {
    const o = asBody(v);
    const name = str(o.name).trim();
    const email = str(o.email).trim();
    const hotline = str(o.hotline).trim();
    // tên trường lỗi trùng tên ô nhập của FE (name, email, hotline…) để hiển thị đúng dưới từng ô
    if (!name) errs.add('name', 'Vui lòng nhập tên cửa hàng.');
    else if (name.length > 100) errs.add('name', 'Tên cửa hàng tối đa 100 ký tự.');
    if (!EMAIL_RE.test(email)) errs.add('email', 'Email không hợp lệ.');
    if (!hotline) errs.add('hotline', 'Vui lòng nhập hotline.');
    else if (hotline.length > 20) errs.add('hotline', 'Hotline tối đa 20 ký tự.');
    for (const [k, max] of [
      ['slogan', 200],
      ['address', 255],
      ['taxCode', 20],
    ] as const) {
      if (str(o[k]).length > max) errs.add(k, `Tối đa ${max} ký tự.`);
    }
    // logo mới gửi dạng data-URL ⇒ lưu thành media và giữ URL (không nhét base64 vào settings)
    let logoUrl: string | null = o.logoUrl ? str(o.logoUrl) : null;
    if (logoUrl?.startsWith('data:') && !errs.any()) {
      const id = await this.ingest.ingestImage(logoUrl, { userId: null, folder: 'settings' });
      const m = await this.prisma.media.findUniqueOrThrow({ where: { id } });
      logoUrl = this.views.url(m.filePath);
    }
    return {
      name,
      slogan: str(o.slogan),
      email,
      hotline,
      address: str(o.address),
      taxCode: str(o.taxCode),
      logoUrl,
    };
  }

  private payments(v: unknown, errs: FieldErrors, field: string): Json {
    if (!Array.isArray(v)) {
      errs.add(field, 'Danh sách phương thức thanh toán không hợp lệ.');
      return [];
    }
    const seen = new Set<string>();
    const out = v.map((x, i) => {
      const o = asBody(x);
      const method = str(o.method);
      if (!PAYMENT_METHODS.includes(method)) errs.add(`${field}.${i}.method`, 'Phương thức không hợp lệ.');
      if (seen.has(method)) errs.add(`${field}.${i}.method`, 'Phương thức bị trùng.');
      seen.add(method);
      if (typeof o.enabled !== 'boolean')
        errs.add(`${field}.${i}.enabled`, 'Trạng thái bật/tắt không hợp lệ.');
      if (str(o.description).length > 255) errs.add(`${field}.${i}.description`, 'Mô tả tối đa 255 ký tự.');
      return { method, enabled: o.enabled === true, description: str(o.description) };
    });
    return out;
  }

  private zones(v: unknown, errs: FieldErrors, field: string): Json {
    if (!Array.isArray(v)) {
      errs.add(field, 'Danh sách vùng vận chuyển không hợp lệ.');
      return [];
    }
    return v.map((x, i) => {
      const o = asBody(x);
      const name = str(o.name).trim();
      if (!name) errs.add(`${field}.${i}.name`, 'Vui lòng nhập tên vùng.');
      else if (name.length > 100) errs.add(`${field}.${i}.name`, 'Tên vùng tối đa 100 ký tự.');
      const zone: Record<string, Json> = {
        id: Number.isInteger(Number(o.id)) && Number(o.id) > 0 ? Number(o.id) : i + 1,
        name,
        fee: this.num(o.fee, `${field}.${i}.fee`, errs),
        eta: str(o.eta).slice(0, 50),
      };
      if (o.freeFrom !== undefined && o.freeFrom !== null && o.freeFrom !== '')
        zone.freeFrom = this.num(o.freeFrom, `${field}.${i}.freeFrom`, errs);
      return zone;
    });
  }

  private async coerce(key: string, v: unknown, errs: FieldErrors, field = 'value'): Promise<Json> {
    switch (key) {
      case 'store':
        return this.store(v, errs);
      case 'payments':
        return this.payments(v, errs, field);
      case 'shippingZones':
        return this.zones(v, errs, field);
      case 'site_name': {
        const s = str(v).trim();
        if (!s || s.length > 100) errs.add(field, 'Tên website 1–100 ký tự.');
        return s;
      }
      case 'contact_email': {
        const s = str(v).trim();
        if (!EMAIL_RE.test(s)) errs.add(field, 'Email không hợp lệ.');
        return s;
      }
      case 'contact_phone': {
        const s = str(v).trim();
        if (!s || s.length > 20) errs.add(field, 'Số điện thoại 1–20 ký tự.');
        return s;
      }
      case 'currency': {
        const s = str(v).trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(s)) errs.add(field, 'Tiền tệ phải là mã 3 chữ cái (ví dụ VND).');
        return s;
      }
      case 'default_shipping_fee':
      case 'free_shipping_threshold':
        return this.num(v, field, errs);
      case 'ar_enabled':
      case 'maintenance_mode':
        if (typeof v !== 'boolean') errs.add(field, 'Giá trị phải là true hoặc false.');
        return v === true;
      default:
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Khóa cài đặt không được phép.', {
          key: [`"${key}" không nằm trong danh sách khóa cho phép.`],
        });
    }
  }

  private async write(adminId: number, changes: Array<{ key: string; value: Json }>) {
    await this.prisma.$transaction(async (tx) => {
      for (const c of changes) {
        const before = (await tx.setting.findUnique({ where: { key: c.key } }))?.value ?? null;
        await tx.setting.upsert({
          where: { key: c.key },
          update: { value: c.value, updatedAt: new Date() },
          create: { key: c.key, value: c.value },
        });
        await this.activity.log(
          {
            actorId: adminId,
            action: 'setting.update',
            targetType: 'setting',
            changes: { key: c.key, before: before as Json, after: c.value },
          },
          tx,
        );
      }
    });
  }

  /** PUT /admin/settings/store (trang Cài đặt FE): { store?, payments?, shippingZones? } – chỉ ghi phần được gửi */
  async saveStore(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const changes: Array<{ key: string; value: Json }> = [];
    for (const key of STRUCT_KEYS) {
      if (b[key] === undefined) continue;
      const value = await this.coerce(key, b[key], errs, key);
      changes.push({ key, value });
    }
    errs.throwIfAny();
    if (changes.length) await this.write(adminId, changes);
    return this.view();
  }

  /** PUT /admin/settings/:key (UC-ADM-03): { value } – khóa ngoài danh sách ⇒ 400 */
  async saveKey(adminId: number, key: string, raw: unknown) {
    if (!SETTING_KEYS.includes(key)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Khóa cài đặt không được phép.', {
        key: [`"${key}" không nằm trong danh sách khóa cho phép.`],
      });
    }
    const b = asBody(raw);
    if (!('value' in b)) new FieldErrors().add('value', 'Thiếu giá trị.').throwIfAny();
    const errs = new FieldErrors();
    const value = await this.coerce(key, b.value, errs);
    errs.throwIfAny();
    await this.write(adminId, [{ key, value }]);
    return { key, value };
  }
}
