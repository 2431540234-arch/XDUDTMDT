// Thông tin quy trình tạo → chuẩn hóa → duyệt của MỘT mô hình, lưu trong product_3d_models.viewer_config.pipeline
// (không thêm cột). KHÔNG BAO GIỜ lưu token vào đây. Khóa `pipeline` bị loại khỏi mọi dữ liệu trả cho khách.
import type { ModelStatus } from '@aurelia-living/shared-types';
import type { LodName } from '../jobs.constants';
import type { NormalizeReport } from './normalize';

export type ModelSource = 'ai' | 'upload';
export type PipelineStage = 'queued' | 'generating' | 'normalizing' | 'review' | 'approved' | 'failed';
/** `cleaned` = đã gỡ tấm sàn; `original` = giữ nguyên hình học */
export type VariantKey = 'cleaned' | 'original';

export interface PipelineFile {
  /** khóa trong bucket PRIVATE (chỉ tồn tại tới khi duyệt/bỏ) */
  key: string;
  size: number;
  polygonCount: number | null;
  textureResolution: number | null;
  isCompressed: boolean;
  checksum: string;
}

export interface PipelineVariant {
  files: Record<LodName, PipelineFile>;
  report: NormalizeReport;
}

export interface ModelPipeline {
  source: ModelSource;
  stage: PipelineStage;
  createdAt: string;
  createdBy: number | null;
  fileName: string;
  /** tệp GLB thô trong bucket PRIVATE (giữ để chuẩn hóa lại mà không gọi AI) */
  rawKey?: string;
  rawBytes?: number;
  options: { removeFloor: boolean; yawDeg: number };
  // ---- riêng mô hình AI
  space?: string;
  sourceImageId?: number;
  sourceImageMediaId?: number;
  /** màu của ảnh đầu vào (nếu ảnh gắn biến thể) – trang 3D ghi "Mô hình thể hiện màu X" */
  colorName?: string | null;
  generatedSeconds?: number;
  // ---- kết quả chuẩn hóa
  variants?: Partial<Record<VariantKey, PipelineVariant>>;
  chosen?: VariantKey;
  normalization?: NormalizeReport;
  error?: { message: string; kind?: string; raw?: string; at: string };
}

export function readPipeline(viewerConfig: unknown): ModelPipeline | null {
  const p = (viewerConfig as { pipeline?: ModelPipeline } | null)?.pipeline;
  return p && typeof p === 'object' && p.source ? p : null;
}

export function withPipeline(viewerConfig: unknown, pipeline: ModelPipeline): object {
  return { ...((viewerConfig ?? {}) as object), pipeline };
}

/** Cấu hình trình xem trả cho khách: bỏ toàn bộ thông tin nội bộ của quy trình */
export function publicViewerConfig(viewerConfig: unknown): Record<string, unknown> {
  const { pipeline: _pipeline, ...rest } = (viewerConfig ?? {}) as Record<string, unknown>;
  return rest;
}

/** Trạng thái đang "chiếm chỗ": mỗi sản phẩm chỉ được một mô hình đang chạy hoặc chờ duyệt */
export const ACTIVE_STATUSES: ModelStatus[] = ['uploading', 'processing', 'pending_review'];

export type ModelAction = 'approve' | 'reject' | 'renormalize' | 'regenerate';

/** Máy trạng thái của các thao tác duyệt. Trả về lý do nếu KHÔNG được phép. */
export function actionBlocker(
  action: ModelAction,
  status: ModelStatus,
  pipeline: ModelPipeline | null,
): string | null {
  switch (action) {
    case 'approve':
      return status === 'pending_review' && pipeline?.variants
        ? null
        : 'Chỉ duyệt được mô hình đang chờ duyệt.';
    case 'reject':
      return status === 'pending_review' || status === 'failed' || status === 'uploading'
        ? null
        : 'Chỉ bỏ được mô hình đang chờ duyệt, lỗi hoặc tải dở.';
    case 'renormalize':
      return (status === 'pending_review' || status === 'failed') && pipeline?.rawKey
        ? null
        : 'Chỉ chuẩn hóa lại được mô hình chờ duyệt hoặc lỗi còn tệp gốc.';
    case 'regenerate':
      return (status === 'pending_review' || status === 'failed') && pipeline?.source === 'ai'
        ? null
        : 'Chỉ tạo lại được mô hình AI đang chờ duyệt hoặc lỗi.';
  }
}

/** Phiên bản mặc định hiện ra khi duyệt: bản đã gỡ sàn nếu có */
export function defaultVariantKey(pipeline: ModelPipeline): VariantKey {
  return pipeline.variants?.cleaned ? 'cleaned' : 'original';
}

export const pendingKey = (modelId: number, variant: VariantKey, lod: LodName, checksum: string) =>
  `models/pending/${modelId}/${variant}-${lod}-${checksum.slice(0, 12)}.glb`;
