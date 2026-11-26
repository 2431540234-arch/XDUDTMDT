// UC-ADM-31 – Tạo mô hình 3D bằng AI từ MỘT ảnh sản phẩm: kiểm tra điều kiện và hạn mức, tạo bản ghi chờ, đẩy job.
// Job gọi nhà cung cấp, lưu GLB thô vào kho private rồi chuyển sang luồng chuẩn hóa chung (rồi chờ duyệt).
import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ErrorCode, type ModelProcessingAccepted } from '@aurelia-living/shared-types';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import sharp from 'sharp';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { startOfDayVn, vnYmd } from '../../common/utils/vn-date';
import { FieldErrors, asBody, toId } from '../../common/utils/validate';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { readPipeline, withPipeline } from '../jobs/model-processing/model-pipeline';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminModelCatalogService } from '../product-models/admin-model-catalog.service';
import { ModelReviewService } from '../product-models/model-review.service';
import { AiProviderError, rawMessage } from './ai-errors';
import { AI3D_QUEUE, type Ai3dJobData } from './ai3d.constants';
import { THREE_D_PROVIDER, type ThreeDProvider } from './three-d-provider';

const RASTER = /^image\/(jpeg|png|webp)$/;

@Injectable()
export class Ai3dService {
  private readonly logger = new Logger(Ai3dService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
    private readonly catalog: AdminModelCatalogService,
    private readonly review: ModelReviewService,
    @InjectQueue(AI3D_QUEUE) private readonly queue: Queue<Ai3dJobData>,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(THREE_D_PROVIDER) private readonly provider: ThreeDProvider,
  ) {}

  /** Số lần yêu cầu tạo trong 1 giờ qua và từ 00:00 hôm nay (giờ Việt Nam), tính cho CẢ hệ thống */
  private async usage(tx: Prisma.TransactionClient = this.prisma) {
    const count = (since: Date) =>
      tx.activityLog.count({ where: { action: 'model.ai_requested', createdAt: { gte: since } } });
    const [hour, today] = await Promise.all([
      count(new Date(Date.now() - 3_600_000)),
      count(startOfDayVn(vnYmd())),
    ]);
    return {
      usedLastHour: hour,
      perHour: this.config.get('AI3D_MAX_JOBS_PER_HOUR'),
      usedToday: today,
      perDay: this.config.get('AI3D_MAX_JOBS_PER_DAY'),
    };
  }

  private limitMessage(u: Awaited<ReturnType<Ai3dService['usage']>>): string | null {
    if (u.usedToday >= u.perDay)
      return `Đã dùng hết ${u.perDay} lượt tạo của hôm nay. Lượt được tính lại từ 00:00 (giờ Việt Nam).`;
    if (u.usedLastHour >= u.perHour)
      return `Đã đạt giới hạn ${u.perHour} lượt tạo trong một giờ. Hãy thử lại sau.`;
    return null;
  }

  /** Trạng thái tính năng cho trang admin. KHÔNG bao giờ chứa token. */
  async status() {
    const reason = this.provider.unavailableReason();
    const usage = await this.usage();
    // lỗi gần nhất TỪ máy chủ AI: bỏ qua lỗi ảnh đầu vào (chưa gọi đi)
    const failures = await this.prisma.activityLog.findMany({
      where: { action: 'model.ai_failed' },
      orderBy: { id: 'desc' },
      take: 20,
    });
    const last = failures.find((l) => (l.changes as { kind?: string } | null)?.kind !== 'bad_input');
    const changes = (last?.changes ?? {}) as { message?: string; raw?: string; space?: string };
    return {
      enabled: !reason,
      reason,
      provider: this.provider.id,
      spaces: reason ? [] : this.provider.spaces(),
      usage,
      limitReached: this.limitMessage(usage),
      lastError: last
        ? {
            at: last.createdAt.toISOString(),
            message: changes.message ?? '',
            raw: changes.raw ?? '',
            space: changes.space ?? null,
          }
        : null,
    };
  }

  /** Kiểm tra yêu cầu tạo; ném lỗi rõ ràng, chưa ghi gì */
  private async validate(raw: unknown) {
    const body = asBody(raw);
    const reason = this.provider.unavailableReason();
    if (reason) throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, reason);
    const errs = new FieldErrors();
    const product = await this.prisma.product.findFirst({
      where: { id: toId(body.productId), deletedAt: null },
      include: { productImages: { include: { media: true } } },
    });
    if (!product) errs.add('productId', 'Sản phẩm không tồn tại.');
    const image = product?.productImages.find((i) => i.id === toId(body.imageId));
    if (product && !image) errs.add('imageId', 'Ảnh không thuộc sản phẩm này.');
    else if (image && !RASTER.test(image.media.mimeType))
      errs.add('imageId', 'Chỉ dùng được ảnh chụp JPG, PNG hoặc WebP (không dùng ảnh minh họa SVG).');
    const spaces = this.provider.spaces();
    const space = body.space ? String(body.space) : spaces[0]?.id;
    if (!spaces.some((s) => s.id === space)) errs.add('space', 'Space không được phép.');
    // người dùng phải xác nhận gửi ảnh cho bên thứ ba
    if (body.consent !== true)
      errs.add('consent', 'Cần xác nhận cho phép gửi ảnh tới Hugging Face (bên thứ ba).');
    errs.throwIfAny();
    return {
      product: product!,
      image: image!,
      space: space!,
      removeFloor: body.removeFloor === undefined ? true : Boolean(body.removeFloor),
    };
  }

  /** Màu mà ảnh thể hiện: màu của biến thể gắn với ảnh (nếu có) */
  private async colorOf(variantId: number | null) {
    if (!variantId) return null;
    const link = await this.prisma.variantAttributeValue.findFirst({
      where: { variantId, attributeCode: 'color' },
      include: { attributeValue: true },
    });
    return link?.attributeValue.value ?? null;
  }

  async request(adminId: number, raw: unknown): Promise<ModelProcessingAccepted> {
    const input = await this.validate(raw);
    const colorName = await this.colorOf(input.image.variantId);
    const primary = input.product.productImages.filter((i) => i.isPrimary);
    const modelId = await this.prisma.$transaction(async (tx) => {
      // khóa chung: hai yêu cầu đồng thời không cùng vượt hạn mức
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7302, 0)`;
      const limit = this.limitMessage(await this.usage(tx));
      if (limit) throw new AppException(ErrorCode.RATE_LIMITED, limit);
      const model = await this.catalog.createPendingModel(
        tx,
        {
          product: { id: input.product.id, productImages: primary },
          variantId: null,
          placement: 'floor',
        },
        'processing',
        {
          source: 'ai',
          stage: 'queued',
          createdAt: new Date().toISOString(),
          createdBy: adminId,
          fileName: `ai-${input.product.slug}.glb`,
          options: { removeFloor: input.removeFloor, yawDeg: 0 },
          space: input.space,
          sourceImageId: input.image.id,
          sourceImageMediaId: input.image.mediaId,
          colorName,
        },
      );
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.ai_requested',
          targetType: 'product3dmodel',
          targetId: model.id,
          changes: {
            productId: input.product.id,
            imageMediaId: input.image.mediaId,
            space: input.space,
            consent: true,
          },
        },
        tx,
      );
      return model.id;
    });
    try {
      const job = await this.queue.add(
        'generate',
        { modelId, adminId },
        { jobId: `ai3d-${modelId}-${Date.now()}` },
      );
      return { modelId, jobId: String(job.id), status: 'processing' };
    } catch (e) {
      await this.fail(modelId, new AiProviderError('unknown', rawMessage(e)));
      throw e;
    }
  }

  /** "Tạo lại": bỏ bản đang chờ duyệt / lỗi rồi tạo yêu cầu mới (tính vào hạn mức) */
  async regenerate(adminId: number, modelId: number, raw: unknown): Promise<ModelProcessingAccepted> {
    const model = await this.prisma.product3DModel.findUnique({ where: { id: modelId } });
    if (!model) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    const pipeline = readPipeline(model.viewerConfig);
    if (!['pending_review', 'failed'].includes(model.status) || pipeline?.source !== 'ai')
      throw new AppException(ErrorCode.INVALID_STATE, 'Chỉ tạo lại được mô hình AI đang chờ duyệt hoặc lỗi.');
    const body = asBody(raw);
    const next = {
      productId: model.productId,
      imageId: body.imageId ?? pipeline.sourceImageId,
      space: body.space ?? pipeline.space,
      removeFloor: body.removeFloor ?? pipeline.options.removeFloor,
      consent: body.consent,
    };
    // kiểm tra hết điều kiện TRƯỚC khi bỏ bản cũ: lỗi thì admin không mất gì
    await this.validate(next);
    const limit = this.limitMessage(await this.usage());
    if (limit) throw new AppException(ErrorCode.RATE_LIMITED, limit);
    await this.review.reject(adminId, modelId);
    return this.request(adminId, next);
  }

  /** Ảnh gửi đi: PNG, cạnh dài tối đa 1600 px. Lỗi ở đây là lỗi phía mình, chưa gọi máy chủ AI */
  private async prepareImage(key: string): Promise<Buffer> {
    try {
      return await sharp(await this.storage.download(key, 'public'))
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch (e) {
      throw new AiProviderError('bad_input', rawMessage(e));
    }
  }

  /** Thân job: gọi nhà cung cấp rồi chuyển sang chuẩn hóa. Ném AiProviderError khi lỗi (chưa đổi trạng thái). */
  async runGeneration({ modelId, adminId }: Ai3dJobData): Promise<void> {
    const model = await this.prisma.product3DModel.findUnique({ where: { id: modelId } });
    const pipeline = readPipeline(model?.viewerConfig);
    // đã bị bỏ, hoặc đã có tệp thô (job chạy lại): không gọi AI nữa
    if (!model || model.status !== 'processing' || pipeline?.source !== 'ai' || pipeline.rawKey) return;
    const media = await this.prisma.media.findUnique({ where: { id: pipeline.sourceImageMediaId! } });
    if (!media) throw new AiProviderError('bad_input', 'Ảnh đầu vào không còn tồn tại.');
    const image = await this.prepareImage(media.filePath);

    pipeline.stage = 'generating';
    delete pipeline.error;
    await this.prisma.product3DModel.update({
      where: { id: modelId },
      data: { viewerConfig: withPipeline(model.viewerConfig, pipeline) as never },
    });

    const result = await this.provider.generate({ image, space: pipeline.space! });

    const rawKey = `models/incoming/p${model.productId}/ai-${randomUUID()}.glb`;
    await this.storage.upload({
      key: rawKey,
      body: result.glb,
      contentType: 'model/gltf-binary',
      visibility: 'private',
    });
    const saved = await this.prisma.product3DModel.updateMany({
      where: { id: modelId, status: 'processing' },
      data: {
        viewerConfig: withPipeline(model.viewerConfig, {
          ...pipeline,
          stage: 'normalizing',
          rawKey,
          rawBytes: result.glb.length,
          generatedSeconds: result.seconds,
        }) as never,
      },
    });
    if (!saved.count) {
      await this.storage.delete(rawKey, 'private').catch(() => undefined);
      return;
    }
    await this.jobs.enqueueModel({
      modelId,
      format: 'glb',
      lod: 'high',
      sourceKey: rawKey,
      fileName: pipeline.fileName,
      uploadedBy: adminId,
    });
    this.logger.log(`Mô hình ${modelId}: AI tạo xong sau ${result.seconds}s, chuyển sang chuẩn hóa.`);
  }

  /** Đánh dấu lỗi cuối cùng: câu dễ hiểu cho admin + nguyên văn (đã che token) */
  async fail(modelId: number, error: AiProviderError): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const model = await tx.product3DModel.findUnique({ where: { id: modelId } });
      const pipeline = readPipeline(model?.viewerConfig);
      if (!model || model.status !== 'processing' || !pipeline || pipeline.rawKey) return;
      pipeline.stage = 'failed';
      pipeline.error = {
        message: error.message,
        kind: error.kind,
        raw: error.raw,
        at: new Date().toISOString(),
      };
      await tx.product3DModel.update({
        where: { id: modelId },
        data: { status: 'failed', viewerConfig: withPipeline(model.viewerConfig, pipeline) as never },
      });
      await this.activity.log(
        {
          actorId: pipeline.createdBy,
          action: 'model.ai_failed',
          targetType: 'product3dmodel',
          targetId: modelId,
          changes: { kind: error.kind, message: error.message, raw: error.raw, space: pipeline.space },
        },
        tx,
      );
      if (pipeline.createdBy)
        await this.notifications.notify(
          tx,
          pipeline.createdBy,
          'Tạo mô hình 3D bằng AI thất bại',
          'system',
          error.message,
          `/admin/products/${model.productId}`,
        );
    });
    this.logger.warn(`Mô hình ${modelId}: tạo bằng AI lỗi (${error.kind}): ${error.raw}`);
  }
}
