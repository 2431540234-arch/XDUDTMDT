// Nội dung công khai: FAQ và cài đặt cửa hàng công khai.
// Bảng: settings
import { Injectable } from '@nestjs/common';
import { CatalogCache } from '../../cache/catalog-cache';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCache,
  ) {}

  // ---------------- FAQ ----------------
  async faq(): Promise<
    Array<{ key: string; label: string; items: Array<{ question: string; answer: string }> }>
  > {
    const row = await this.prisma.setting.findUnique({ where: { key: 'faq' } });
    return Array.isArray(row?.value) ? (row!.value as never) : [];
  }

  // ---------------- cài đặt công khai ----------------
  /** Cài đặt công khai: cache 10 phút (admin sửa cài đặt thì xóa cache) */
  publicSettings() {
    return this.cache.settingsPublic(() => this.loadPublicSettings());
  }

  private async loadPublicSettings() {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: ['store', 'payments', 'shippingZones'] } },
    });
    const get = (key: string) => rows.find((r) => r.key === key)?.value ?? null;
    return {
      store: get('store'),
      payments: get('payments') ?? [],
      shippingZones: get('shippingZones') ?? [],
    };
  }
}
