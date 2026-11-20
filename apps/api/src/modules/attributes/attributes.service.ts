// UC-ADM-08 – Quản lý GIÁ TRỊ thuộc tính. Loại thuộc tính là enum attribute_code (color | size | material), không còn bảng attributes
// và không tạo/sửa/xóa loại. (attribute_code, value) UNIQUE, trùng ⇒ 409. Xóa giá trị đang được biến thể dùng ⇒ 409: DB sẽ xóa dây
// chuyền variant_attribute_values nên Service phải chặn. Ghi bản ghi + activity_logs trong CÙNG một transaction (D-T52).
import { Injectable } from '@nestjs/common';
import { AttributeCode } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

/** Ba loại thuộc tính hệ thống (id giữ nguyên số cũ để không đổi hợp đồng API) */
export const ATTRIBUTE_INFO: Record<AttributeCode, { id: number; name: string }> = {
  color: { id: 1, name: 'Màu sắc' },
  size: { id: 2, name: 'Kích thước' },
  material: { id: 3, name: 'Chất liệu' },
};
const CODES = Object.keys(ATTRIBUTE_INFO) as AttributeCode[];
const codeOfId = (id: number) => CODES.find((c) => ATTRIBUTE_INFO[c].id === id);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type ValueRow = {
  id: number;
  attributeCode: AttributeCode;
  value: string;
  colorHex: string | null;
  _count: { variantAttributeValues: number };
};

@Injectable()
export class AttributesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
  ) {}

  private valueView(v: ValueRow) {
    return {
      id: v.id,
      attributeId: ATTRIBUTE_INFO[v.attributeCode].id,
      value: v.value,
      colorHex: v.colorHex,
      usageCount: v._count.variantAttributeValues,
    };
  }

  private async view(code: AttributeCode) {
    const values = await this.prisma.attributeValue.findMany({
      where: { attributeCode: code },
      orderBy: { id: 'asc' },
      include: { _count: { select: { variantAttributeValues: true } } },
    });
    return {
      id: ATTRIBUTE_INFO[code].id,
      code,
      name: ATTRIBUTE_INFO[code].name,
      isSystem: true,
      values: values.map((v) => this.valueView(v)),
    };
  }

  async list() {
    return Promise.all(CODES.map((c) => this.view(c)));
  }

  private codeOf(attributeId: number): AttributeCode {
    const code = codeOfId(attributeId);
    if (!code) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Thuộc tính không tồn tại.');
    return code;
  }

  private conflict(field: string, message: string): never {
    throw new AppException(ErrorCode.CONFLICT, message, { [field]: [message] });
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

  private async valueOf(attributeCode: AttributeCode, valueId: number) {
    const v = await this.prisma.attributeValue.findFirst({
      where: { id: valueId, attributeCode },
      include: { _count: { select: { variantAttributeValues: true } } },
    });
    if (!v) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Giá trị thuộc tính không tồn tại.');
    return v;
  }

  async addValue(adminId: number, attributeId: number, raw: unknown) {
    const code = this.codeOf(attributeId);
    const d = this.checkValue(asBody(raw), code === 'color', false);
    if (
      await this.prisma.attributeValue.findFirst({
        where: { attributeCode: code, value: d.value },
        select: { id: true },
      })
    )
      this.conflict('value', 'Giá trị này đã có trong thuộc tính.');
    const id = await this.prisma.$transaction(async (tx) => {
      const v = await tx.attributeValue.create({
        data: { attributeCode: code, value: d.value!, colorHex: d.colorHex ?? null },
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
    return (await this.view(code)).values.find((v) => v.id === id)!;
  }

  async updateValue(adminId: number, attributeId: number, valueId: number, raw: unknown) {
    const code = this.codeOf(attributeId);
    const cur = await this.valueOf(code, valueId);
    const d = this.checkValue(asBody(raw), code === 'color', true);
    if (
      d.value !== undefined &&
      (await this.prisma.attributeValue.findFirst({
        where: { attributeCode: code, value: d.value, id: { not: valueId } },
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
    return (await this.view(code)).values.find((v) => v.id === valueId)!;
  }

  async removeValue(adminId: number, attributeId: number, valueId: number) {
    const code = this.codeOf(attributeId);
    const cur = await this.valueOf(code, valueId);
    const inVariants = cur._count.variantAttributeValues;
    if (inVariants) {
      throw new AppException(
        ErrorCode.RESOURCE_IN_USE,
        `Giá trị "${cur.value}" đang được ${inVariants} biến thể sử dụng, không thể xóa.`,
        { variants: inVariants },
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
