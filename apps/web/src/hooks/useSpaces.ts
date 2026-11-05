'use client';

// Custom hook TanStack Query để lấy dữ liệu không gian mẫu
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { spaceApi, type SpaceQuery } from '@/services/space.api';

export function useSpaces(q: SpaceQuery = {}) {
  return useQuery({
    queryKey: ['spaces', q],
    queryFn: () => spaceApi.list(q),
    placeholderData: keepPreviousData,
  });
}

export function useSpace(slug: string) {
  return useQuery({ queryKey: ['space', slug], queryFn: () => spaceApi.detail(slug) });
}

export function useSpaceFacets() {
  return useQuery({ queryKey: ['spaces', 'facets'], queryFn: spaceApi.facets });
}
