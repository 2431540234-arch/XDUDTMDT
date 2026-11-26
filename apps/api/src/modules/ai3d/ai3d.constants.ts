export const AI3D_QUEUE = 'ai3d-generation';

export interface Ai3dJobData {
  modelId: number;
  adminId: number;
}

/** 1 lần chạy + tối đa 1 lần thử lại (chỉ cho lỗi chắc chắn tạm thời) */
export const AI3D_ATTEMPTS = 2;
export const AI3D_RETRY_DELAY_MS = 60_000;
