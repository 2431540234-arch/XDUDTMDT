// Tạo bản webp và thumbnail cho ảnh sản phẩm / panorama. Không phụ thuộc BullMQ/HTTP.
import { Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { STORAGE_SERVICE, type StorageService } from '../../../storage/storage.service';
import type { ImageJobData } from '../jobs.constants';

export interface ImageProcessingResult {
  webpKey: string;
  thumbKey: string;
}

/** key gốc "images/ab.jpg" -> webp "images/ab.webp", thumbnail "images/ab_thumb.webp" */
export function derivedKeys(key: string): ImageProcessingResult {
  const stem = key.replace(/\.[^./]+$/, '');
  return { webpKey: `${stem}.webp`, thumbKey: `${stem}_thumb.webp` };
}

@Injectable()
export class ImageProcessingService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async process(data: ImageJobData): Promise<ImageProcessingResult> {
    const source = await this.storage.download(data.key, 'public');
    const maxWidth = data.kind === 'panorama' ? 8192 : 2048;
    const { webpKey, thumbKey } = derivedKeys(data.key);

    const webp = await sharp(source)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const thumb = await sharp(source)
      .rotate()
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    await this.storage.upload({ key: webpKey, body: webp, contentType: 'image/webp', visibility: 'public' });
    await this.storage.upload({
      key: thumbKey,
      body: thumb,
      contentType: 'image/webp',
      visibility: 'public',
    });
    return { webpKey, thumbKey };
  }
}
