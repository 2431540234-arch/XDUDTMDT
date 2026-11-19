// Service gọi API không gian mẫu (spaces)
import type { RoomType } from '@aurelia-living/shared-types';
import type { CartView, PlacementAlternative, SpaceDetail, SpaceListItem } from '@/types/api';
import { http } from './api-client';

export interface SpaceQuery {
  q?: string;
  roomType?: RoomType | '';
  style?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  /** slug sản phẩm: chỉ các không gian có chứa sản phẩm này (UC-SPACE-06) */
  product?: string;
}

export interface SpaceFacets {
  styles: Array<{ value: string; count: number }>;
  roomTypes: Array<{ value: RoomType; count: number }>;
}

export const spaceApi = {
  list: (q: SpaceQuery = {}) =>
    http.list<SpaceListItem>('/spaces', q as Record<string, string | number | boolean>),
  facets: () => http.get<SpaceFacets>('/spaces/facets'),
  detail: (slug: string) => http.get<SpaceDetail>(`/spaces/${slug}`),
  /** UC-SPACE-05: chỉ để xem thử, không lưu */
  alternatives: (slug: string, placementId: number) =>
    http.get<PlacementAlternative[]>(`/spaces/${slug}/placements/${placementId}/alternatives`),
  /** Thêm các món đã chọn của không gian vào giỏ: MỘT request, một transaction (tất cả hoặc không món nào; lỗi ⇒ 409 kèm details.unavailable) */
  addToCart: (slug: string, productIds?: number[]) =>
    http.post<{
      added: Array<{ productId: number; name: string; variantId: number }>;
      unavailable: never[];
      cart: CartView;
    }>(`/spaces/${slug}/add-to-cart`, productIds ? { productIds } : {}),
};
