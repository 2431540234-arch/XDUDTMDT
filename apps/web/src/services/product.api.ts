// Service gọi API sản phẩm, danh mục, đánh giá, hỏi đáp, yêu thích, mô hình 3D
import type {
  CategoryNode,
  Model3DView,
  ProductDetail,
  ProductFacets,
  ProductListItem,
  ProductQuestion,
  ReviewView,
} from '@/types/api';
import { http, type Query } from './api-client';

export interface ProductQuery extends Query {
  q?: string;
  category?: string;
  brand?: string;
  /** "0-5000000,5000000-10000000" hoặc minPrice/maxPrice */
  minPrice?: number;
  maxPrice?: number;
  color?: string[];
  material?: string[];
  style?: string[];
  has3d?: boolean;
  hasAr?: boolean;
  featured?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export const productApi = {
  list: (q: ProductQuery) => http.list<ProductListItem>('/products', q),
  search: (q: ProductQuery) => http.list<ProductListItem>('/products/search', q),
  facets: (q: ProductQuery) => http.get<ProductFacets>('/products/facets', q), // TODO: chưa có trong BE
  detail: (slug: string) => http.get<ProductDetail>(`/products/${slug}`),
  model: (slug: string) => http.get<Model3DView | null>(`/products/${slug}/model`),
  related: (slug: string) => http.get<ProductListItem[]>(`/products/${slug}/related`), // TODO: chưa có trong BE
  reviews: (slug: string, q: { page?: number; rating?: number } = {}) =>
    http.list<ReviewView>(`/products/${slug}/reviews`, q),
  createReview: (
    slug: string,
    body: {
      orderId: number;
      rating: number;
      content: string;
      tags?: string[];
      images?: string[];
      anonymous?: boolean;
    },
  ) => http.post<ReviewView>(`/products/${slug}/reviews`, body),
  questions: (slug: string) => http.get<ProductQuestion[]>(`/products/${slug}/questions`), // TODO: chưa có trong BE
  askQuestion: (slug: string, content: string) =>
    http.post<ProductQuestion>(`/products/${slug}/questions`, { content }),
};

export const categoryApi = {
  tree: () => http.get<CategoryNode[]>('/categories'),
};

export const wishlistApi = {
  list: () => http.get<ProductListItem[]>('/wishlist'),
  add: (slug: string) => http.put<null>(`/wishlist/${slug}`),
  remove: (slug: string) => http.delete(`/wishlist/${slug}`),
};
