// Giao diện lưu trữ tệp. Module nghiệp vụ chỉ phụ thuộc vào STORAGE_SERVICE, không biết driver cụ thể.
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface UploadInput {
  /** Đường dẫn tương đối trong kho, ví dụ "products/12/anh-1.webp" */
  path: string;
  body: Buffer;
  contentType?: string;
}

export interface StorageService {
  /** Lưu tệp, trả về path đã lưu (để ghi vào media.file_path). */
  upload(input: UploadInput): Promise<string>;
  delete(path: string): Promise<void>;
  /** URL công khai để client tải tệp. */
  getUrl(path: string): string;
}
