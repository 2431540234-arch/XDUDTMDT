// Kiểu cho luồng tải lên bằng presigned URL (docs/API_CONVENTIONS.md mục 8)
export type UploadKind = 'panorama';

export interface PresignUploadRequest {
  kind: UploadKind;
  fileName: string;
  mimeType: string;
  /** Dung lượng byte; được ký vào URL nên client phải PUT đúng dung lượng này. */
  size: number;
}

export interface PresignedUpload {
  /** Object key, gửi lại khi xác nhận. */
  key: string;
  uploadUrl: string;
  method: 'PUT';
  /** Header BẮT BUỘC gửi kèm khi PUT. */
  headers: Record<string, string>;
  expiresIn: number;
}

export interface ConfirmUploadRequest {
  key: string;
  kind: UploadKind;
  fileName: string;
  mimeType: string;
  altText?: string;
}

export interface PresignModelFileRequest {
  format: 'glb' | 'usdz';
  lod?: 'high' | 'medium' | 'low';
  fileName: string;
  size: number;
}

export interface ConfirmModelFileRequest {
  key: string;
  format: 'glb' | 'usdz';
  lod?: 'high' | 'medium' | 'low';
  fileName: string;
}

export interface ModelProcessingAccepted {
  modelId: number;
  jobId: string;
  status: 'processing';
}
