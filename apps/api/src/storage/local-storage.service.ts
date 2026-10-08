import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../common/exceptions/app.exception';
import { AppConfig } from '../config/app-config.service';
import type {
  ObjectInfo,
  PresignedPut,
  PresignPutInput,
  StorageService,
  UploadInput,
  Visibility,
} from './storage.service';

/**
 * Lưu tệp trên đĩa cục bộ. Cấu trúc: <STORAGE_LOCAL_DIR>/public/<key> và <STORAGE_LOCAL_DIR>/private/<key>.
 * Chỉ thư mục public được API phục vụ tại /uploads. Không hỗ trợ presigned URL.
 */
@Injectable()
export class LocalStorageService implements StorageService {
  readonly driver = 'local' as const;
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(config: AppConfig) {
    this.root = resolve(config.get('STORAGE_LOCAL_DIR'));
    this.publicUrl = config.get('STORAGE_PUBLIC_URL').replace(/\/+$/, '');
  }

  /** Thư mục public, dùng để phục vụ tĩnh tại /uploads. */
  get publicRoot(): string {
    return resolve(this.root, 'public');
  }

  async upload({ key, body, visibility = 'public' }: UploadInput): Promise<string> {
    const target = this.resolveSafe(key, visibility);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
    return key;
  }

  download(key: string, visibility: Visibility = 'public'): Promise<Buffer> {
    return readFile(this.resolveSafe(key, visibility));
  }

  async delete(key: string, visibility: Visibility = 'public'): Promise<void> {
    await rm(this.resolveSafe(key, visibility), { force: true });
  }

  async head(key: string, visibility: Visibility = 'public'): Promise<ObjectInfo | null> {
    try {
      const s = await stat(this.resolveSafe(key, visibility));
      return { size: s.size };
    } catch {
      return null;
    }
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  presignPut(_input: PresignPutInput): Promise<PresignedPut> {
    throw new AppException(
      ErrorCode.BAD_REQUEST,
      'Kho tệp local không hỗ trợ tải lên bằng URL ký sẵn. Đặt STORAGE_DRIVER=minio.',
    );
  }

  presignGet(key: string): Promise<string> {
    return Promise.resolve(this.getUrl(key));
  }

  async ping(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  /** Chặn path traversal ("../"): đích phải nằm trong thư mục gốc của visibility tương ứng. */
  private resolveSafe(key: string, visibility: Visibility): string {
    const base = resolve(this.root, visibility);
    const target = resolve(base, key);
    if (target !== base && !target.startsWith(base + sep)) {
      throw new AppException(ErrorCode.BAD_REQUEST, 'Đường dẫn tệp không hợp lệ.');
    }
    return target;
  }
}
