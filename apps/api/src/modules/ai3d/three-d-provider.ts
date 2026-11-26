// Giao diện nhà cung cấp tạo mô hình 3D từ ảnh. Thêm dịch vụ trả phí (Tripo, Meshy…) chỉ cần một lớp mới.
export const THREE_D_PROVIDER = Symbol('THREE_D_PROVIDER');

export interface ThreeDSpaceInfo {
  id: string;
  label: string;
  role: 'primary' | 'fallback';
  note: string;
}

export interface GenerateInput {
  /** ảnh PNG */
  image: Buffer;
  /** id space (một trong spaces()) */
  space: string;
}

export interface GenerateResult {
  glb: Buffer;
  space: string;
  seconds: number;
}

export interface ThreeDProvider {
  readonly id: string;
  /** lý do tính năng đang tắt, hoặc null nếu dùng được */
  unavailableReason(): string | null;
  spaces(): ThreeDSpaceInfo[];
  /** Ném AiProviderError khi lỗi (thông báo đã che token) */
  generate(input: GenerateInput): Promise<GenerateResult>;
}
