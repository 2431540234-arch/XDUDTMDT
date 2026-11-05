'use client';

// Custom hook TanStack Query để lấy dữ liệu sản phẩm, danh mục
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { categoryApi, productApi, type ProductQuery } from '@/services/product.api';

export function useProducts(q: ProductQuery, mode: 'list' | 'search' = 'list') {
  return useQuery({
    queryKey: ['products', mode, q],
    queryFn: () => (mode === 'search' ? productApi.search(q) : productApi.list(q)),
    placeholderData: keepPreviousData,
  });
}

export function useProductFacets(q: ProductQuery) {
  return useQuery({
    queryKey: ['products', 'facets', q.q],
    queryFn: () => productApi.facets({ q: q.q }),
  });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: ['product', slug], queryFn: () => productApi.detail(slug) });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: categoryApi.tree, staleTime: 10 * 60_000 });
}
