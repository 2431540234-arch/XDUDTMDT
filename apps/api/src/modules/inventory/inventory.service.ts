// UC-ADM-12 – Kho: tồn kho theo biến thể, lịch sử biến động (inventory_movements), nhập/điều chỉnh tồn trực tiếp và PHIẾU nhập/xuất kho
// (phương án b′): phiếu là chứng từ; XÁC NHẬN phiếu mới ghi movement + đổi tồn. Nháp/hủy không đổi tồn.
// Mọi thay đổi tồn đều kèm đúng một movement trong cùng transaction (không dùng trigger, QUY_UOC §5.1).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { nextExpenseCode, nextReceiptCode } from '../../common/utils/code-generator';
import { qNum, qStr, resolvePage, parseSort, type RawQuery } from '../../common/utils/list-query';
import { asBody, FieldErrors, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

const ROW_INCLUDE = {
  product: {
    include: {
      category: true,
      productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 },
    },
  },
  variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } },
} satisfies Prisma.ProductVariantInclude;

const RECEIPT_INCLUDE = {
  items: { include: { variant: { include: ROW_INCLUDE } }, orderBy: { id: 'asc' } },
} satisfies Prisma.StockReceiptInclude;
type ReceiptRow = Prisma.StockReceiptGetPayload<{ include: typeof RECEIPT_INCLUDE }>;

const MOVEMENT_TYPES = ['import', 'adjustment', 'return'] as const;
const vnToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const int = (v: unknown) => (typeof v === 'number' ? v : Number(str(v)));

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly activity: ActivityLogService,
  ) {}

  // ---------------------------------------------------------------- tồn kho theo biến thể
  private async allRows() {
    const variants = await this.prisma.productVariant.findMany({
      where: { isActive: true, product: { deletedAt: null } },
      include: ROW_INCLUDE,
      orderBy: { id: 'asc' },
    });
    return variants.map((v) => {
      const label = this.views.variantLabel(v);
      const stock = v.stockQuantity;
      const state: 'in_stock' | 'low' | 'out' = stock <= 0 ? 'out' : stock <= v.minStock ? 'low' : 'in_stock';
      return {
        variantId: v.id,
        productId: v.productId,
        productName: `${v.product.name}${label !== 'Tiêu chuẩn' ? ` – ${label}` : ''}`,
        imageUrl: this.views.url(v.product.productImages[0]?.media.filePath),
        sku: v.sku,
        categoryId: v.product.categoryId,
        categoryName: v.product.category?.name ?? '—',
        costPrice: Number(v.costPrice),
        stockQuantity: stock,
        available: this.views.available(v),
        minStock: v.minStock,
        state,
      };
    });
  }

  async rows(q: RawQuery) {
    const search = foldVi(qStr(q, 'q'));
    const state = qStr(q, 'state');
    const cat = qNum(q, 'categoryId', 0);
    let list = await this.allRows();
    if (search) list = list.filter((r) => foldVi(`${r.productName} ${r.sku}`).includes(search));
    if (['in_stock', 'low', 'out'].includes(state)) list = list.filter((r) => r.state === state);
    if (cat) {
      const cats = await this.prisma.category.findMany({
        where: { OR: [{ id: cat }, { parentId: cat }] },
        select: { id: true },
      });
      const ids = new Set(cats.map((c) => c.id));
      list = list.filter((r) => r.categoryId != null && ids.has(r.categoryId));
    }
    const sort = parseSort(qStr(q, 'sort') || 'available:asc', [
      'productName',
      'stockQuantity',
      'available',
      'costPrice',
    ]) ?? { field: 'available', dir: 'asc' as const };
    const dir = sort.dir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      const x = a[sort.field as 'productName'];
      const y = b[sort.field as 'productName'];
      const c = typeof x === 'string' ? x.localeCompare(String(y), 'vi') : Number(x) - Number(y);
      return c * dir || a.variantId - b.variantId;
    });
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize).map(({ categoryId: _c, ...r }) => r),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  async summary() {
    const rows = await this.allRows();
    return {
      totalStock: rows.reduce((s, r) => s + r.stockQuantity, 0),
      stockValue: rows.reduce((s, r) => s + r.stockQuantity * r.costPrice, 0),
      lowCount: rows.filter((r) => r.state === 'low').length,
      outCount: rows.filter((r) => r.state === 'out').length,
    };
  }

  // ---------------------------------------------------------------- lịch sử biến động + ghi biến động trực tiếp
  async movements(q: RawQuery) {
    const where: Prisma.InventoryMovementWhereInput = {};
    const variantId = qNum(q, 'variantId', 0);
    if (variantId) where.variantId = variantId;
    const type = qStr(q, 'type');
    if (['import', 'sale', 'return', 'adjustment'].includes(type)) where.type = type as never;
    const from = qStr(q, 'from');
    const to = qStr(q, 'to');
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(`${from}T00:00:00+07:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999+07:00`) } : {}),
      };
    }
    const total = await this.prisma.inventoryMovement.count({ where });
    const page = resolvePage(q, total, 20);
    const rows = await this.prisma.inventoryMovement.findMany({
      where,
      include: { variant: { include: ROW_INCLUDE }, performedByUser: { select: { fullName: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return {
      items: rows.map((m) => {
        const label = this.views.variantLabel(m.variant);
        return {
          id: m.id,
          variantId: m.variantId,
          sku: m.variant.sku,
          productName: `${m.variant.product.name}${label !== 'Tiêu chuẩn' ? ` – ${label}` : ''}`,
          type: m.type,
          quantityChange: m.quantityChange,
          reason: m.reason,
          referenceCode: m.referenceCode,
          performedByName: m.performedByUser?.fullName ?? 'Hệ thống',
          createdAt: m.createdAt,
        };
      }),
      page: page.page,
      pageSize: page.pageSize,
      total,
    };
  }

  /** POST /admin/inventory/movements – nhập (import), điều chỉnh (adjustment ±), ghi nhận hàng trả (return). `sale` chỉ do hệ thống tạo. */
  async record(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const variantId = Number(b.variantId);
    const type = str(b.type);
    const qty = int(b.quantityChange);
    if (!Number.isInteger(variantId) || variantId <= 0) errs.add('variantId', 'Vui lòng chọn biến thể.');
    if (!(MOVEMENT_TYPES as readonly string[]).includes(type))
      errs.add('type', 'Loại biến động phải là import, adjustment hoặc return.');
    if (!Number.isInteger(qty) || qty === 0)
      errs.add('quantityChange', 'Số lượng thay đổi phải là số nguyên khác 0.');
    else if (type !== 'adjustment' && qty < 0)
      errs.add('quantityChange', 'Nhập kho/hàng trả phải có số lượng dương.');
    const reason = str(b.reason).trim();
    if (reason.length > 255) errs.add('reason', 'Lý do tối đa 255 ký tự.');
    const ref = str(b.referenceCode).trim();
    if (ref.length > 100) errs.add('referenceCode', 'Mã chứng từ tối đa 100 ký tự.');
    errs.throwIfAny();

    return this.prisma.$transaction(async (tx) => {
      const v = await this.applyMovement(tx, {
        variantId,
        type: type as 'import' | 'adjustment' | 'return',
        change: qty,
        reason: reason || null,
        reference: ref || null,
        adminId,
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'inventory.record',
          targetType: 'product_variant',
          targetId: variantId,
          changes: { type, quantityChange: qty, stockQuantity: v.stockQuantity },
        },
        tx,
      );
      const m = await tx.inventoryMovement.findFirstOrThrow({
        where: { variantId },
        orderBy: { id: 'desc' },
      });
      return { variantId, stockQuantity: v.stockQuantity, movement: m };
    });
  }

  /** Đổi tồn bằng UPDATE có điều kiện (không âm) + đúng một movement; thiếu hàng ⇒ 409 */
  private async applyMovement(
    tx: Tx,
    a: {
      variantId: number;
      type: 'import' | 'adjustment' | 'return';
      change: number;
      reason: string | null;
      reference: string | null;
      adminId: number;
      costPrice?: number;
    },
  ) {
    const cur = await tx.productVariant.findUnique({ where: { id: a.variantId } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Biến thể không tồn tại.');
    const r = await tx.productVariant.updateMany({
      where: { id: a.variantId, ...(a.change < 0 ? { stockQuantity: { gte: -a.change } } : {}) },
      data: {
        stockQuantity: { increment: a.change },
        ...(a.costPrice && a.costPrice > 0 ? { costPrice: a.costPrice } : {}),
      },
    });
    if (r.count !== 1) {
      throw new AppException(
        ErrorCode.OUT_OF_STOCK,
        `Tồn kho không đủ cho ${cur.sku} (còn ${cur.stockQuantity}).`,
        {
          variantId: a.variantId,
          available: cur.stockQuantity,
        },
      );
    }
    await tx.inventoryMovement.create({
      data: {
        variantId: a.variantId,
        type: a.type,
        quantityChange: a.change,
        reason: a.reason,
        referenceCode: a.reference,
        performedBy: a.adminId,
      },
    });
    return tx.productVariant.findUniqueOrThrow({ where: { id: a.variantId } });
  }

  // ---------------------------------------------------------------- phiếu nhập/xuất
  private receiptView(r: ReceiptRow) {
    return {
      id: r.id,
      code: r.code,
      type: r.type,
      supplierId: null as number | null,
      supplierName: r.supplierName,
      orderCode: r.orderCode,
      itemCount: r.items.length,
      total: r.items.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0),
      status: r.status,
      createdAt: r.createdAt,
    };
  }

  async receipts() {
    const rows = await this.prisma.stockReceipt.findMany({
      include: RECEIPT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => this.receiptView(r));
  }

  async receipt(id: number) {
    const r = await this.prisma.stockReceipt.findUnique({ where: { id }, include: RECEIPT_INCLUDE });
    if (!r) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Phiếu kho không tồn tại.');
    return {
      ...this.receiptView(r),
      items: r.items.map((i) => ({
        variantId: i.variantId,
        sku: i.variant.sku,
        productName: `${i.variant.product.name} – ${this.views.variantLabel(i.variant)}`,
        quantity: i.quantity,
        costPrice: Number(i.costPrice),
      })),
    };
  }

  /** { type: in|out, supplierName?, orderCode?, status?: draft|completed (mặc định completed), items:[{variantId, quantity, costPrice}] } */
  async createReceipt(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const type = str(b.type);
    if (type !== 'in' && type !== 'out') errs.add('type', 'Loại phiếu không hợp lệ.');
    const supplierName = str(b.supplierName).trim();
    if (type === 'in' && !supplierName) errs.add('supplierName', 'Vui lòng nhập nhà cung cấp.');
    if (supplierName.length > 150) errs.add('supplierName', 'Tên nhà cung cấp tối đa 150 ký tự.');
    const orderCode = str(b.orderCode).trim();
    if (orderCode.length > 50) errs.add('orderCode', 'Mã đơn tối đa 50 ký tự.');
    const status = str(b.status) || 'completed';
    if (status !== 'draft' && status !== 'completed')
      errs.add('status', 'Trạng thái phiếu phải là draft hoặc completed.');
    const items = Array.isArray(b.items) ? (b.items as Array<Record<string, unknown>>) : [];
    if (!items.length) errs.add('items', 'Vui lòng thêm ít nhất một sản phẩm.');
    const lines = new Map<number, { quantity: number; costPrice: number }>();
    for (const it of items) {
      const variantId = toId(it.variantId);
      const quantity = int(it.quantity);
      const costPrice = it.costPrice === undefined || it.costPrice === '' ? 0 : Number(it.costPrice);
      if (!variantId) {
        errs.add('items', 'Biến thể không hợp lệ.');
        break;
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        errs.add('items', 'Số lượng phải từ 1 trở lên.');
        break;
      }
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        errs.add('items', 'Giá vốn không hợp lệ.');
        break;
      }
      // cùng biến thể nhiều dòng ⇒ cộng dồn số lượng, giá vốn lấy dòng cuối
      const cur = lines.get(variantId);
      lines.set(variantId, { quantity: (cur?.quantity ?? 0) + quantity, costPrice });
    }
    errs.throwIfAny();

    const ids = [...lines.keys()];
    const found = await this.prisma.productVariant.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length)
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Biến thể không tồn tại.');

    const id = await this.prisma.$transaction(async (tx) => {
      const code = await nextReceiptCode(tx, type as 'in' | 'out');
      const r = await tx.stockReceipt.create({
        data: {
          code,
          type: type as 'in' | 'out',
          supplierName: supplierName || null,
          orderCode: orderCode || null,
          status: 'draft',
          createdBy: adminId,
          items: {
            create: [...lines.entries()].map(([variantId, l]) => ({
              variantId,
              quantity: l.quantity,
              costPrice: l.costPrice,
            })),
          },
        },
        include: { items: true },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'inventory.receipt_create',
          targetType: 'stock_receipt',
          targetId: r.id,
          changes: { code, type, status },
        },
        tx,
      );
      if (status === 'completed') await this.complete(tx, r.id, adminId);
      return r.id;
    });
    return this.receipt(id).then(({ items: _i, ...v }) => v);
  }

  /** Phiếu nháp → hoàn tất: ghi movement + đổi tồn; phiếu nhập cập nhật giá vốn biến thể và sinh phiếu chi giá vốn */
  private async complete(tx: Tx, receiptId: number, adminId: number) {
    const [locked] = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM stock_receipts WHERE id = ${receiptId} FOR UPDATE`;
    if (!locked) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Phiếu kho không tồn tại.');
    if (locked.status !== 'draft')
      throw new AppException(ErrorCode.INVALID_STATE, 'Chỉ phiếu nháp mới xác nhận được.');
    const r = await tx.stockReceipt.findUniqueOrThrow({
      where: { id: receiptId },
      include: { items: { orderBy: { variantId: 'asc' } } }, // khóa theo thứ tự id ⇒ không deadlock giữa hai phiếu
    });
    for (const it of r.items) {
      await this.applyMovement(tx, {
        variantId: it.variantId,
        type: r.type === 'in' ? 'import' : 'adjustment',
        change: r.type === 'in' ? it.quantity : -it.quantity,
        reason: r.type === 'in' ? `Nhập kho theo phiếu ${r.code}` : `Xuất kho theo phiếu ${r.code}`,
        reference: r.code,
        adminId,
        costPrice: r.type === 'in' ? Number(it.costPrice) : undefined,
      });
    }
    await tx.stockReceipt.update({ where: { id: receiptId }, data: { status: 'completed' } });
    if (r.type === 'in') {
      const total = r.items.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0);
      if (total > 0) {
        await tx.expense.create({
          data: {
            code: await nextExpenseCode(tx),
            category: 'cogs',
            amount: total,
            note: `Giá vốn phiếu nhập ${r.code}`,
            date: new Date(vnToday()),
            receiptId: r.id,
          },
        });
      }
    }
  }

  async confirmReceipt(adminId: number, id: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.complete(tx, id, adminId);
      await this.activity.log(
        { actorId: adminId, action: 'inventory.receipt_confirm', targetType: 'stock_receipt', targetId: id },
        tx,
      );
    });
    return this.receipt(id).then(({ items: _i, ...v }) => v);
  }

  async cancelReceipt(adminId: number, id: number) {
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM stock_receipts WHERE id = ${id} FOR UPDATE`;
      if (!locked) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Phiếu kho không tồn tại.');
      if (locked.status !== 'draft')
        throw new AppException(ErrorCode.INVALID_STATE, 'Chỉ phiếu nháp mới hủy được.');
      await tx.stockReceipt.update({ where: { id }, data: { status: 'cancelled' } });
      await this.activity.log(
        { actorId: adminId, action: 'inventory.receipt_cancel', targetType: 'stock_receipt', targetId: id },
        tx,
      );
    });
    return this.receipt(id).then(({ items: _i, ...v }) => v);
  }
}
