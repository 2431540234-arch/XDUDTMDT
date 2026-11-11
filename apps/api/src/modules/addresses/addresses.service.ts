// M03 – Sổ địa chỉ giao hàng: mỗi khách có tối đa 1 địa chỉ mặc định (đúng 1 nếu còn địa chỉ). Cho phép xóa hết địa chỉ.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, PHONE_RE, asBody, str } from '../../common/utils/validate';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  private validate(b: Record<string, unknown>) {
    const errs = new FieldErrors();
    if (str(b.recipientName).trim().length < 2) errs.add('recipientName', 'Vui lòng nhập tên người nhận.');
    if (!PHONE_RE.test(str(b.phone))) errs.add('phone', 'Số điện thoại phải gồm 10 chữ số.');
    if (!str(b.province).trim()) errs.add('province', 'Vui lòng chọn tỉnh/thành.');
    if (!str(b.district).trim()) errs.add('district', 'Vui lòng nhập quận/huyện.');
    if (!str(b.ward).trim()) errs.add('ward', 'Vui lòng nhập phường/xã.');
    if (!str(b.addressLine).trim()) errs.add('addressLine', 'Vui lòng nhập số nhà, tên đường.');
    errs.throwIfAny();
  }

  list(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
  }

  /**
   * Khóa dòng user trong transaction: mọi thao tác sổ địa chỉ của CÙNG một user chạy tuần tự (chống race làm có hai mặc định,
   * vi phạm uq_addresses_user_default, hoặc không còn mặc định dù còn địa chỉ). User khác nhau không chặn nhau.
   */
  private lockUser(tx: Prisma.TransactionClient, userId: number) {
    return tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  }

  private async own(userId: number, id: number) {
    const a = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!a) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Địa chỉ không tồn tại.');
    return a;
  }

  async create(userId: number, raw: unknown) {
    const b = asBody(raw);
    this.validate(b);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const count = await tx.address.count({ where: { userId } });
      const isDefault = count === 0 || Boolean(b.isDefault);
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({
        data: {
          userId,
          recipientName: str(b.recipientName).trim(),
          phone: str(b.phone),
          province: str(b.province),
          district: str(b.district),
          ward: str(b.ward),
          addressLine: str(b.addressLine),
          isDefault,
          label: str(b.label) || 'Địa chỉ khác',
        },
      });
    });
  }

  async update(userId: number, id: number, raw: unknown) {
    const a = await this.own(userId, id);
    const b = { ...a, ...asBody(raw) };
    this.validate(b);
    const body = asBody(raw);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      if (!(await tx.address.findFirst({ where: { id, userId }, select: { id: true } })))
        throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Địa chỉ không tồn tại.');
      if (body.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({
        where: { id },
        data: {
          recipientName: str(b.recipientName).trim(),
          phone: str(b.phone),
          province: str(b.province),
          district: str(b.district),
          ward: str(b.ward),
          addressLine: str(b.addressLine),
          ...(body.label ? { label: str(body.label) } : {}),
          ...(body.isDefault ? { isDefault: true } : {}),
        },
      });
    });
  }

  /** Xóa địa chỉ (được xóa cả địa chỉ cuối cùng). Xóa địa chỉ mặc định ⇒ địa chỉ MỚI NHẤT còn lại thành mặc định */
  async remove(userId: number, id: number) {
    await this.own(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const a = await tx.address.findFirst({ where: { id, userId } });
      if (!a) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Địa chỉ không tồn tại.');
      await tx.address.delete({ where: { id } });
      if (a.isDefault) {
        const newest = await tx.address.findFirst({ where: { userId }, orderBy: { id: 'desc' } });
        if (newest) await tx.address.update({ where: { id: newest.id }, data: { isDefault: true } });
      }
      return null;
    });
  }

  async setDefault(userId: number, id: number) {
    await this.own(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      if (!(await tx.address.findFirst({ where: { id, userId }, select: { id: true } })))
        throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Địa chỉ không tồn tại.');
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });
  }
}
