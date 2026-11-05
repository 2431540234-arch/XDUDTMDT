// Service gọi API không gian mẫu (spaces)
import type { RoomType } from '@aurelia-living/shared-types';
import type { SpaceDetail, SpaceListItem } from '@/types/api';
import { http } from './api-client';

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
  bookmark: (slug: string) => http.put<null>(`/spaces/${slug}/bookmark`),
  unbookmark: (slug: string) => http.delete(`/spaces/${slug}/bookmark`),
};
