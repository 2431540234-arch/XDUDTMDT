// Hạ tầng hàng đợi (BullMQ + Redis). Xem docs/DECISIONS.md D-T21.
// Worker hiện chạy CÙNG tiến trình API. Processor chỉ là lớp mỏng gọi *ProcessingService (không phụ thuộc HTTP),
// nên sau này tách sang apps/worker bằng cách import JobsModule trong một app Nest riêng mà không sửa logic.

export const MODEL_QUEUE = 'model-processing';
export const IMAGE_QUEUE = 'image-processing';

export type LodName = 'high' | 'medium' | 'low';

/** Dữ liệu job xử lý mô hình 3D. Tệp gốc nằm ở bucket PRIVATE. */
export interface ModelJobData {
  modelId: number;
  format: 'glb' | 'usdz';
  /** Dùng cho USDZ (admin tải thủ công từng LOD). GLB tự sinh đủ high/medium/low. */
  lod: LodName;
  sourceKey: string;
  fileName: string;
  uploadedBy: number | null;
}

/** Dữ liệu job xử lý ảnh. Tệp gốc nằm ở bucket PUBLIC, đã có bản ghi media. */
export interface ImageJobData {
  mediaId: number;
  key: string;
  kind: 'image' | 'panorama';
}

export const JOB_ATTEMPTS = 3;
