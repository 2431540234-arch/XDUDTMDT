// Service gọi API không gian mẫu (spaces)
import type { RoomType } from '@aurelia-living/shared-types';
import type { PlacementAlternative, SpaceDetail, SpaceListItem } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import { USE_MOCK, apiClient, http } from './api-client';

export interface SpaceViewBody {
  visitorId: string;
  /** slug (từ ?from=) hoặc id sản phẩm dẫn tới */
  sourceProductId?: string | number;
  hotspotClickCount?: number;
  addedToCart?: boolean;
}

export interface SpaceQuery {
  q?: string;
  roomType?: RoomType | '';
  style?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  bookmarked?: boolean;
}

export interface SpaceFacets {
  styles: Array<{ value: string; count: number }>;
  roomTypes: Array<{ value: RoomType; count: number }>;
}

export const spaceApi = {
  list: (q: SpaceQuery = {}) =>
    http.list<SpaceListItem>('/spaces', q as Record<string, string | number | boolean>),
  facets: () => http.get<SpaceFacets>('/spaces/facets'), // TODO: chưa có trong BE
  detail: (slug: string) => http.get<SpaceDetail>(`/spaces/${slug}`),
  /** UC-SPACE-05: chỉ để xem thử, không lưu */
  alternatives: (slug: string, placementId: number) =>
    http.get<PlacementAlternative[]>(`/spaces/${slug}/placements/${placementId}/alternatives`),
  /** Ghi một lượt xem khi mở không gian (UC-SPACE-06); BE để trigger tăng view_count */
  recordView: (slug: string, body: SpaceViewBody) => http.post<null>(`/spaces/${slug}/views`, body),
  /**
   * Ghi lượt xem MỘT lần khi rời trang (UC-SPACE-06): navigator.sendBeacon không đặt được header nên gửi kèm accessToken (nếu có)
   * trong body. Dữ liệu giả (mock) không có mạng ⇒ gọi qua mock API.
   */
  sendViewBeacon: (slug: string, body: SpaceViewBody) => {
    if (USE_MOCK) {
      void http.post<null>(`/spaces/${slug}/views`, body).catch(() => undefined);
      return;
    }
    const url = `${apiClient.baseURL}/spaces/${slug}/views`;
    const payload = JSON.stringify({
      ...body,
      accessToken: useAuthStore.getState().accessToken ?? undefined,
    });
    if (!(
      typeof navigator !== 'undefined' &&
      navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }))
    )) {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }
  },
  bookmark: (slug: string) => http.put<null>(`/spaces/${slug}/bookmark`),
  unbookmark: (slug: string) => http.delete(`/spaces/${slug}/bookmark`),
};
