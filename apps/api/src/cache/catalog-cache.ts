// Cache Redis cho dữ liệu công khai (D-T30, API_CONVENTIONS §8.6). Chỉ cache dữ liệu KHÔNG theo người dùng (giỏ, đơn,
// yêu thích... không bao giờ vào đây; cờ "đã yêu thích" được gắn SAU khi lấy từ cache). Khóa và TTL theo D-T30:
//   categories:tree 10 phút · products:featured… 2 phút · settings:public 10 phút · pages:<slug> 10 phút · products:<slug> 1 phút
//   catalog:index 2 phút (chỉ mục danh sách/tìm kiếm/facet của ProductsService, thay chỉ mục RAM 15 giây)
// Admin sửa dữ liệu nào thì xóa khóa tương ứng (bảng "thao tác ghi → khóa bị xóa" ở docs/CHUAN_MO_RONG.md).
// Lỗi Redis hoặc CACHE_ENABLED=false ⇒ CacheService coi như cache miss, request vẫn được phục vụ từ DB.
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

export const CACHE_TTL = {
  categoriesTree: 10 * 60,
  productsFeatured: 2 * 60,
  settingsPublic: 10 * 60,
  page: 10 * 60,
  product: 60,
  catalogIndex: 2 * 60,
} as const;

export const CACHE_KEYS = {
  categoriesTree: 'categories:tree',
  settingsPublic: 'settings:public',
  catalogIndex: 'catalog:index',
  page: (slug: string) => `pages:${slug}`,
  product: (slug: string) => `products:${slug}`,
  featured: (query: unknown) =>
    `products:featured:${createHash('sha1').update(JSON.stringify(query)).digest('hex').slice(0, 16)}`,
} as const;

@Injectable()
export class CatalogCache {
  constructor(private readonly cache: CacheService) {}

  categoriesTree<T>(loader: () => Promise<T>) {
    return this.cache.getOrSet(CACHE_KEYS.categoriesTree, loader, CACHE_TTL.categoriesTree);
  }
  settingsPublic<T>(loader: () => Promise<T>) {
    return this.cache.getOrSet(CACHE_KEYS.settingsPublic, loader, CACHE_TTL.settingsPublic);
  }
  page<T>(slug: string, loader: () => Promise<T>) {
    return this.cache.getOrSet(CACHE_KEYS.page(slug), loader, CACHE_TTL.page);
  }
  product<T>(slug: string, loader: () => Promise<T>) {
    return this.cache.getOrSet(CACHE_KEYS.product(slug), loader, CACHE_TTL.product);
  }
  featured<T>(query: unknown, loader: () => Promise<T>) {
    return this.cache.getOrSet(CACHE_KEYS.featured(query), loader, CACHE_TTL.productsFeatured);
  }
  catalogIndex<T>(loader: () => Promise<T>) {
    return this.cache.getOrSet(CACHE_KEYS.catalogIndex, loader, CACHE_TTL.catalogIndex);
  }

  /** Sản phẩm, biến thể, ảnh, tồn kho, mô hình 3D, đánh giá... đổi: chi tiết, nổi bật, chỉ mục danh sách */
  async invalidateProducts(): Promise<void> {
    await Promise.all([this.cache.delByPrefix('products:'), this.cache.del(CACHE_KEYS.catalogIndex)]);
  }
  /** Danh mục, thương hiệu, thuộc tính đổi: ảnh hưởng cả cây danh mục lẫn dữ liệu sản phẩm hiển thị */
  async invalidateCatalog(): Promise<void> {
    await Promise.all([this.invalidateProducts(), this.cache.delByPrefix('categories:')]);
  }
  async invalidateSettings(): Promise<void> {
    await this.cache.del(CACHE_KEYS.settingsPublic);
  }
  async invalidatePages(): Promise<void> {
    await this.cache.delByPrefix('pages:');
  }
}
