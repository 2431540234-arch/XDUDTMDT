// UC-ADM-08 – Quản lý thuộc tính (Màu sắc, Kích thước, Chất liệu…) và giá trị. code/name UNIQUE, (attributeId, value) UNIQUE,
// trùng ⇒ 409. Xóa giá trị đang được biến thể (hoặc ảnh 360°) dùng ⇒ 409: DB sẽ xóa dây chuyền variant_attribute_values nên
// Service phải chặn. Ghi bản ghi + activity_logs trong CÙNG một transaction (D-T52).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

/** Thuộc tính hệ thống: code được mã nguồn dùng để dựng nhãn biến thể/màu 360° ⇒ không đổi code, không xóa */
export const SYSTEM_ATTRIBUTE_CODES = ['color', 'size', 'material'];

const INCLUDE = {
  attributeValues: {
    orderBy: { id: 'asc' },
    include: { _count: { select: { variantAttributeValues: true, product360Frames: true } } },
  },
} satisfies Prisma.AttributeInclude;
type Row = Prisma.AttributeGetPayload<{ include: typeof INCLUDE }>;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

@Injectable()
export class AttributesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
  ) {}

  private view(a: Row) {
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      isSystem: SYSTEM_ATTRIBUTE_CODES.includes(a.code),
      values: a.attributeValues.map((v) => ({
        id: v.id,
        attributeId: v.attributeId,
        value: v.value,
        colorHex: v.colorHex,
        usageCount: v._count.variantAttributeValues,
        frameCount: v._count.product360Frames,
      })),
    };
  }

  async list() {
    const rows = await this.prisma.attribute.findMany({ include: INCLUDE, orderBy: { id: 'asc' } });
    return rows.map((a) => this.view(a));
  }

  private async one(id: number) {
    const a = await this.prisma.attribute.findUnique({ where: { id }, include: INCLUDE });
    if (!a) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Thuộc tính không tồn tại.');
    return a;
  }

  private conflict(field: string, message: string): never {
    throw new AppException(ErrorCode.CONFLICT, message, { [field]: [message] });
  }

  // ---------------------------------------------------------------- thuộc tính
  private checkAttr(b: Record<string, unknown>, partial: boolean) {
    const errs = new FieldErrors();
    const out: { code?: string; name?: string } = {};
    if (!partial || b.code !== undefined) {
      const code = str(b.code).trim();
      if (!code) errs.add('code', 'Vui lòng nhập mã thuộc tính.');
      else if (code.length > 50) errs.add('code', 'Mã thuộc tính tối đa 50 ký tự.');
      else if (!/^[a-z][a-z0-9_]*$/.test(code))
        errs.add('code', 'Mã thuộc tính chỉ gồm chữ thường không dấu, số và gạch dưới (bắt đầu bằng chữ).');
      out.code = code;
    }
    if (!partial || b.name !== undefined) {
      const name = str(b.name).trim();
      if (!name) errs.add('name', 'Vui lòng nhập tên thuộc tính.');
      else if (name.length > 100) errs.add('name', 'Tên thuộc tính tối đa 100 ký tự.');
      out.name = name;
    }
    errs.throwIfAny();
    return out;
  }

  private async uniqueAttr(d: { code?: string; name?: string }, selfId?: number) {
    const not = selfId ? { id: { not: selfId } } : {};
    if (
      d.code &&
      (await this.prisma.attribute.findFirst({ where: { code: d.code, ...not }, select: { id: true } }))
    )
      this.conflict('code', 'Mã thuộc tính đã tồn tại.');
    if (
      d.name &&
      (await this.prisma.attribute.findFirst({ where: { name: d.name, ...not }, select: { id: true } }))
    )
      this.conflict('name', 'Tên thuộc tính đã tồn tại.');
  }

  async create(adminId: number, raw: unknown) {
    const d = this.checkAttr(asBody(raw), false);
    await this.uniqueAttr(d);
    const id = await this.prisma.$transaction(async (tx) => {
      const a = await tx.attribute.create({ data: { code: d.code!, name: d.name! } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'attribute.create',
          targetType: 'attribute',
          targetId: a.id,
          changes: { ...d },
        },
        tx,
      );
      return a.id;
    });
    return this.view(await this.one(id));
  }

  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.one(id);
    const d = this.checkAttr(asBody(raw), true);
    if (d.code !== undefined && d.code !== cur.code && SYSTEM_ATTRIBUTE_CODES.includes(cur.code)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Mã của thuộc tính hệ thống không đổi được.', {
        code: ['Mã của thuộc tính hệ thống không đổi được.'],
      });
    }
    await this.uniqueAttr(d, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.attribute.update({ where: { id }, data: { ...d } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'attribute.update',
          targetType: 'attribute',
          targetId: id,
          changes: {
            before: { code: cur.code, name: cur.name },
            after: { code: d.code ?? cur.code, name: d.name ?? cur.name },
          },
        },
        tx,
      );
    });
    await this.products.invalidate();
    return this.view(await this.one(id));
  }

  async remove(adminId: number, id: number) {
    const cur = await this.one(id);
    if (SYSTEM_ATTRIBUTE_CODES.includes(cur.code))
      throw new AppException(
        ErrorCode.RESOURCE_IN_USE,
        'Không xóa được thuộc tính hệ thống (màu sắc, kích thước, chất liệu).',
      );
    const used = cur.attributeValues.reduce(
      (s, v) => s + v._count.variantAttributeValues + v._count.product360Frames,
      0,
    );
    if (used)
      throw new AppException(
        ErrorCode.RESOURCE_IN_USE,
        'Thuộc tính có giá trị đang được biến thể sử dụng, không thể xóa.',
        { usage: used },
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.attribute.delete({ where: { id } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'attribute.delete',
          targetType: 'attribute',
          targetId: id,
          changes: { code: cur.code },
        },
        tx,
      );
    });
    return { id };
  }

  // ---------------------------------------------------------------- giá trị
  private checkValue(b: Record<string, unknown>, isColor: boolean, partial: boolean) {
    const errs = new FieldErrors();
    const out: { value?: string; colorHex?: string | null } = {};
    if (!partial || b.value !== undefined) {
      const value = str(b.value).trim();
      if (!value) errs.add('value', 'Vui lòng nhập giá trị.');
      else if (value.length > 150) errs.add('value', 'Giá trị tối đa 150 ký tự.');
      out.value = value;
    }
    if (b.colorHex !== undefined) {
      const hex = b.colorHex === null || b.colorHex === '' ? null : str(b.colorHex).trim();
      if (hex !== null && !HEX_RE.test(hex)) errs.add('colorHex', 'Mã màu phải dạng #RRGGBB.');
      else if (hex !== null && !isColor) errs.add('colorHex', 'Chỉ thuộc tính màu sắc mới có mã màu.');
      out.colorHex = hex ? hex.toUpperCase() : null;
    }
    errs.throwIfAny();
    return out;
  }

  private async valueOf(attributeId: number, valueId: number) {
    const v = await this.prisma.attributeValue.findFirst({
      where: { id: valueId, attributeId },
      include: { _count: { select: { variantAttributeValues: true, product360Frames: true } } },
    });
    if (!v) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Giá trị thuộc tính không tồn tại.');
    return v;
  }

  async addValue(adminId: number, attributeId: number, raw: unknown) {
    const attr = await this.one(attributeId);
    const d = this.checkValue(asBody(raw), attr.code === 'color', false);
    if (
      await this.prisma.attributeValue.findFirst({
        where: { attributeId, value: d.value },
        select: { id: true },
      })
    )
      this.conflict('value', 'Giá trị này đã có trong thuộc tính.');
    const id = await this.prisma.$transaction(async (tx) => {
      const v = await tx.attributeValue.create({
        data: { attributeId, value: d.value!, colorHex: d.colorHex ?? null },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'attribute_value.create',
          targetType: 'attribute_value',
          targetId: v.id,
          changes: { attributeId, value: d.value },
        },
        tx,
      );
      return v.id;
    });
    return this.view(await this.one(attributeId)).values.find((v) => v.id === id)!;
  }

  async updateValue(adminId: number, attributeId: number, valueId: number, raw: unknown) {
    const attr = await this.one(attributeId);
    const cur = await this.valueOf(attributeId, valueId);
    const d = this.checkValue(asBody(raw), attr.code === 'color', true);
    if (
      d.value !== undefined &&
      (await this.prisma.attributeValue.findFirst({
        where: { attributeId, value: d.value, id: { not: valueId } },
        select: { id: true },
      }))
    )
      this.conflict('value', 'Giá trị này đã có trong thuộc tính.');
    await this.prisma.$transaction(async (tx) => {
      await tx.attributeValue.update({ where: { id: valueId }, data: { ...d } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'attribute_value.update',
          targetType: 'attribute_value',
          targetId: valueId,
          changes: { before: { value: cur.value, colorHex: cur.colorHex }, after: { ...d } },
        },
        tx,
      );
    });
    await this.products.invalidate();
    return this.view(await this.one(attributeId)).values.find((v) => v.id === valueId)!;
  }

  async removeValue(adminId: number, attributeId: number, valueId: number) {
    await this.one(attributeId);
    const cur = await this.valueOf(attributeId, valueId);
    const inVariants = cur._count.variantAttributeValues;
    const inFrames = cur._count.product360Frames;
    if (inVariants || inFrames) {
      throw new AppException(
        ErrorCode.RESOURCE_IN_USE,
        inVariants
          ? `Giá trị "${cur.value}" đang được ${inVariants} biến thể sử dụng, không thể xóa.`
          : `Giá trị "${cur.value}" đang được dùng cho ảnh xoay 360° của sản phẩm, không thể xóa.`,
        { variants: inVariants, frames: inFrames },
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.attributeValue.delete({ where: { id: valueId } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'attribute_value.delete',
          targetType: 'attribute_value',
          targetId: valueId,
          changes: { attributeId, value: cur.value },
        },
        tx,
      );
    });
    return { id: valueId };
  }
}
