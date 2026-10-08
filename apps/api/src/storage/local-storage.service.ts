import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../common/exceptions/app.exception';
import { AppConfig } from '../config/app-config.service';
import type { StorageService, UploadInput } from './storage.service';

/** Lưu tệp trên đĩa cục bộ (dev). Thêm MinioStorage sau này bằng cách implement cùng giao diện. */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(config: AppConfig) {
    this.root = resolve(config.get('STORAGE_LOCAL_DIR'));
    this.publicUrl = config.get('STORAGE_PUBLIC_URL').replace(/\/+$/, '');
  }

  async upload({ path, body }: UploadInput): Promise<string> {
    const target = this.resolveSafe(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
    return path;
  }

  async delete(path: string): Promise<void> {
    await rm(this.resolveSafe(path), { force: true });
  }

  getUrl(path: string): string {
    return `${this.publicUrl}/${path.replace(/^\/+/, '')}`;
  }

  /** Chặn path traversal ("../"): đích phải nằm trong thư mục gốc. */
  private resolveSafe(path: string): string {
    const target = resolve(this.root, path);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new AppException(ErrorCode.BAD_REQUEST, 'Đường dẫn tệp không hợp lệ.');
    }
    return target;
  }
}
