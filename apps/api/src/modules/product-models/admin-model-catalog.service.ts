// UC-ADM-13/14 – Quản trị mô hình 3D: danh sách (lọc sản phẩm/định dạng), tải lên GLB/GLTF/USDZ ≤ 50MB, xóa.
// Mỗi dòng của danh sách là một TỆP (model_files) kèm thông tin mô hình. Trigger DB tự cập nhật has_3d_model/has_ar.
//
// Hai cách tải lên:
//  • POST /admin/models (JSON): FE hiện chỉ gửi metadata {productId,fileName,sizeMB,format,allowAr,scale} (chưa gửi nhị phân).
//    Nếu có `fileData` (data-URL base64) thì BE kiểm tra và lưu đúng tệp đó; nếu không, BE tạo bản sao của một tệp mẫu cùng định dạng
//    để giao diện vẫn xem được (dữ liệu demo).
//  • POST /admin/models/upload (multipart, trường `file`): đường tải thật cho FE khi được nối.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qNum, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { ProductsService } from '../products/products.service';
import { MODEL_MAX_BYTES, validateModelFile, type ModelFormat } from './model-file-validator';

const FILE_INCLUDE = {
  media: true,
  model: {
    include: {
      product: {
        include: { productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 } },
      },
      modelFiles: { include: { media: true } },
      posterMedia: true,
    },
  },
} satisfies Prisma.ModelFileInclude;
type FileRow = Prisma.ModelFileGetPayload<{ include: typeof FILE_INCLUDE }>;

export interface UploadInput {
  productId: unknown;
  variantId?: unknown;
  fileName: string;
  format?: string;
  allowAr?: unknown;
  scale?: unknown;
  unit?: unknown;
  placement?: unknown;
  /** nội dung tệp (multipart hoặc data-URL đã giải mã) */
  bytes?: Buffer;
  mimeType?: string;
  /** dung lượng khai báo (MB) khi chưa có nhị phân */
  sizeMB?: unknown;
}

@Injectable()
export class AdminModelCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private row(f: FileRow) {
    const m = f.model;
    const p = m.product;
    const { modelFiles, posterMedia, product: _p, ...mbase } = m;
    void _p;
    const files = modelFiles.map((x) => ({
      id: x.id,
      modelId: x.modelId,
      format: x.format,
      lod: x.lod,
      mediaId: x.mediaId,
      url: this.views.url(x.media.filePath) ?? '',
      fileName: x.media.fileName,
      fileSize: x.media.fileSize,
    }));
    const glb = files.find((x) => x.format === 'glb')?.url ?? null;
    const usdz = files.find((x) => x.format === 'usdz')?.url ?? null;
    return {
      ...JSON.parse(JSON.stringify(mbase)),
      files,
      id: f.id, // id dòng = id tệp
      glbUrl: glb,
      usdzUrl: usdz,
      posterUrl: this.views.url(posterMedia?.filePath),
      productName: p.name,
      productThumbnailUrl: this.views.url(p.productImages[0]?.media.filePath),
      format: f.format,
      fileName: f.media.fileName,
      sizeMB: Math.round((f.media.fileSize / 1024 / 1024) * 10) / 10,
      uploadedAt: f.createdAt.toISOString(),
    };
  }

  async list(q: RawQuery) {
    const productId = qNum(q, 'productId', 0);
    const format = qStr(q, 'format');
    const search = foldVi(qStr(q, 'q'));
    const rows = await this.prisma.modelFile.findMany({
      where: {
        ...(format ? { format: format as ModelFormat } : {}),
        ...(productId ? { model: { productId } } : {}),
      },
      include: FILE_INCLUDE,
    });
    let list = rows.map((r) => this.row(r));
    if (search) list = list.filter((r) => foldVi(`${r.fileName} ${r.productName}`).includes(search));
    const [field, dir] = (qStr(q, 'sort') || 'uploadedAt:desc').split(':');
    const mul = dir === 'asc' ? 1 : -1;
    const key = (r: (typeof list)[number]): string | number =>
      field === 'sizeMB' ? r.sizeMB : field === 'fileName' ? r.fileName : r.uploadedAt;
    list.sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1) * mul);
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  /** Lấy nhị phân của một tệp mẫu cùng định dạng để làm nội dung cho bản ghi chỉ có metadata */
  private async stockBytes(format: ModelFormat): Promise<Buffer> {
    const f = await this.prisma.modelFile.findFirst({
      where: { format },
      include: { media: true },
      orderBy: { id: 'asc' },
    });
    if (!f)
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        'Chưa có tệp mẫu để tạo mô hình. Hãy tải tệp thật lên (POST /admin/models/upload).',
      );
    return this.storage.download(f.media.filePath, 'public');
  }

  async upload(adminId: number, input: UploadInput) {
    const errs = new FieldErrors();
    const product = await this.prisma.product.findFirst({
      where: { id: toId(input.productId), deletedAt: null },
      include: {
        productImages: { where: { isPrimary: true }, take: 1 },
        productVariants: { take: 1, orderBy: { id: 'asc' } },
      },
    });
    if (!product) errs.add('productId', 'Vui lòng chọn sản phẩm liên kết.');
    let variantId: number | null = null;
    if (input.variantId) {
      variantId = toId(input.variantId);
      if (
        !product ||
        !(await this.prisma.productVariant.findFirst({ where: { id: variantId, productId: product.id } }))
      )
        errs.add('variantId', 'Biến thể không thuộc sản phẩm.');
    }
    const scale = input.scale === undefined || input.scale === '' ? 1 : Number(input.scale);
    if (!(scale > 0 && scale <= 100)) errs.add('scale', 'Tỉ lệ phải lớn hơn 0 và không quá 100.');
    const unit = input.unit ? str(input.unit) : 'mm';
    if (!['mm', 'cm', 'm'].includes(unit)) errs.add('unit', 'Đơn vị phải là mm, cm hoặc m.');
    const placement = input.placement ? str(input.placement) : 'floor';
    if (!['floor', 'wall', 'table'].includes(placement)) errs.add('placement', 'Vị trí đặt không hợp lệ.');
    errs.throwIfAny();

    const declared = input.bytes ? input.bytes.length : Math.round(Number(input.sizeMB) * 1024 * 1024);
    let check;
    try {
      check = validateModelFile({
        fileName: input.fileName,
        sizeBytes: declared,
        declaredFormat: input.format,
        mimeType: input.mimeType,
        bytes: input.bytes,
      });
    } catch (e) {
      if (e instanceof AppException && e.code !== ErrorCode.PAYLOAD_TOO_LARGE)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
          [e.code === ErrorCode.UNSUPPORTED_MEDIA_TYPE ? 'format' : 'file']: [e.message],
        });
      if (e instanceof AppException)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', { file: [e.message] });
      throw e;
    }
    const bytes = input.bytes ?? (await this.stockBytes(check.format));
    if (bytes.length > MODEL_MAX_BYTES)
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, 'Tệp phải nhỏ hơn hoặc bằng 50MB.');

    // tên tệp lưu do server sinh (uuid) ⇒ không thể path traversal
    const key = `models/${product!.id}/${randomUUID()}.${check.ext}`;
    await this.storage.upload({ key, body: bytes, contentType: check.mime, visibility: 'public' });
    const fileSize = input.bytes ? bytes.length : Math.max(1, Math.round(Number(input.sizeMB) * 1024 * 1024));

    const fileId = await this.prisma.$transaction(async (tx) => {
      const media = await tx.media.create({
        data: {
          fileName: check.fileName,
          filePath: key,
          mimeType: check.mime,
          fileSize,
          uploadedBy: adminId,
        },
      });
      let model = await tx.product3DModel.findFirst({ where: { productId: product!.id, isPrimary: true } });
      const dims = await tx.productVariant.findFirst({
        where: { productId: product!.id, lengthCm: { not: null } },
        orderBy: { id: 'asc' },
      });
      if (!model) {
        model = await tx.product3DModel.create({
          data: {
            productId: product!.id,
            variantId,
            lengthMm: dims?.lengthCm ? Math.round(Number(dims.lengthCm) * 10) : 1000,
            widthMm: dims?.widthCm ? Math.round(Number(dims.widthCm) * 10) : 800,
            heightMm: dims?.heightCm ? Math.round(Number(dims.heightCm) * 10) : 800,
            placement: placement as never,
            allowScaling: !input.allowAr,
            viewerConfig: { autoRotate: true, exposure: 1, scale, unit },
            posterMediaId: product!.productImages[0]?.mediaId ?? null,
            status: 'ready',
            isPrimary: true,
          },
        });
      } else {
        model = await tx.product3DModel.update({
          where: { id: model.id },
          data: {
            allowScaling: !input.allowAr,
            placement: placement as never,
            ...(variantId ? { variantId } : {}),
            viewerConfig: { ...((model.viewerConfig ?? {}) as object), scale, unit },
          },
        });
      }
      // mỗi (mô hình, định dạng, LOD) chỉ một tệp: tệp mới thay thế tệp cũ cùng định dạng
      await tx.modelFile.deleteMany({ where: { modelId: model.id, format: check.format, lod: 'high' } });
      const f = await tx.modelFile.create({
        data: {
          modelId: model.id,
          format: check.format,
          lod: 'high',
          mediaId: media.id,
          polygonCount: check.format === 'glb' ? 42_000 : null,
          textureResolution: 2048,
          isCompressed: true,
        },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.upload',
          targetType: 'product3dmodel',
          targetId: model.id,
          changes: { fileName: check.fileName },
        },
        tx,
      );
      return f.id;
    });
    this.products.invalidate();
    return this.row(
      await this.prisma.modelFile.findUniqueOrThrow({ where: { id: fileId }, include: FILE_INCLUDE }),
    );
  }

  /** POST /admin/models (JSON): có thể kèm fileData = data-URL base64 */
  uploadJson(adminId: number, raw: unknown) {
    const b = asBody(raw);
    let bytes: Buffer | undefined;
    let mimeType: string | undefined;
    if (b.fileData) {
      const m = /^data:([\w/+.-]*);base64,(.+)$/s.exec(str(b.fileData));
      if (!m) new FieldErrors().add('file', 'Nội dung tệp không hợp lệ.').throwIfAny();
      mimeType = m![1] || undefined;
      bytes = Buffer.from(m![2], 'base64');
    }
    return this.upload(adminId, {
      ...b,
      fileName: str(b.fileName),
      format: b.format ? str(b.format) : undefined,
      bytes,
      mimeType,
      productId: b.productId,
    });
  }

  async remove(adminId: number, fileId: number) {
    const f = await this.prisma.modelFile.findUnique({ where: { id: fileId }, include: { media: true } });
    if (!f) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    const productId = (await this.prisma.product3DModel.findUniqueOrThrow({ where: { id: f.modelId } }))
      .productId;
    await this.prisma.$transaction(async (tx) => {
      await tx.modelFile.delete({ where: { id: fileId } });
      // tệp cuối cùng ⇒ xóa luôn mô hình (trigger đặt has_3d_model/has_ar = false)
      if (!(await tx.modelFile.count({ where: { modelId: f.modelId } }))) {
        await tx.modelMaterialVariant.deleteMany({ where: { modelId: f.modelId } });
        await tx.product3DModel.delete({ where: { id: f.modelId } });
      }
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.delete',
          targetType: 'product3dmodel',
          targetId: f.modelId,
          changes: { fileName: f.media.fileName, productId },
        },
        tx,
      );
    });
    // xóa tệp vật lý + bản ghi media nếu không còn nơi nào dùng
    const used =
      (await this.prisma.modelFile.count({ where: { mediaId: f.mediaId } })) +
      (await this.prisma.product3DModel.count({ where: { posterMediaId: f.mediaId } }));
    if (!used && f.media.filePath.startsWith('models/')) {
      await this.storage.delete(f.media.filePath, 'public').catch(() => undefined);
      await this.prisma.media.delete({ where: { id: f.mediaId } }).catch(() => undefined);
    }
    this.products.invalidate();
    return null;
  }
}
