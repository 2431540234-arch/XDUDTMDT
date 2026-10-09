// Giao diện lưu trữ tệp. Module nghiệp vụ chỉ phụ thuộc vào STORAGE_SERVICE, không biết driver cụ thể.
// `key` là object key (ví dụ "models/12/sofa-high.glb"), được lưu vào media.file_path; KHÔNG lưu URL tuyệt đối.
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

/**
 * public: ảnh, panorama, mô hình đã xử lý; ai cũng đọc được qua getUrl().
 * private: tệp gốc chờ xử lý, ảnh AR chưa công khai; chỉ đọc qua presignGet().
 */
export type Visibility = 'public' | 'private';

export interface UploadInput {
  key: string;
  body: Buffer;
  contentType?: string;
  visibility?: Visibility;
}

export interface PresignPutInput {
  key: string;
  contentType: string;
  /** Dung lượng khai báo (byte); được ký vào URL nên client phải PUT đúng dung lượng này. */
  size: number;
  visibility?: Visibility;
}

export interface PresignedPut {
  url: string;
  method: 'PUT';
  /** Header client PHẢI gửi kèm khi PUT. */
  headers: Record<string, string>;
  key: string;
  expiresIn: number;
}

export interface ObjectInfo {
  size: number;
  contentType?: string;
}

export interface StorageService {
  readonly driver: 'local' | 'minio' | 's3';
  /** Lưu tệp, trả về key đã lưu. */
  upload(input: UploadInput): Promise<string>;
  download(key: string, visibility?: Visibility): Promise<Buffer>;
  delete(key: string, visibility?: Visibility): Promise<void>;
  /** Thông tin tệp, null nếu không tồn tại. */
  head(key: string, visibility?: Visibility): Promise<ObjectInfo | null>;
  /** URL công khai của tệp trong bucket public. */
  getUrl(key: string): string;
  /** URL để trình duyệt PUT thẳng lên kho (driver local không hỗ trợ). */
  presignPut(input: PresignPutInput): Promise<PresignedPut>;
  /** URL tạm để tải tệp (dùng cho bucket private). */
  presignGet(key: string, visibility?: Visibility, expiresIn?: number): Promise<string>;
  /** Kiểm tra kết nối kho (dùng cho /health). Ném lỗi nếu không dùng được. */
  ping(): Promise<void>;
}
