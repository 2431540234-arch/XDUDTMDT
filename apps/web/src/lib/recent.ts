// Sản phẩm đã xem gần đây (lưu localStorage) – dùng ở trang Giỏ hàng trống (WIREFRAME 7.15)
export interface RecentProduct {
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  price: number;
}

const KEY = 'aurelia-recent';

export function getRecent(): RecentProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as RecentProduct[];
  } catch {
    return [];
  }
}

export function pushRecent(p: RecentProduct) {
  if (typeof window === 'undefined') return;
  const next = [p, ...getRecent().filter((x) => x.slug !== p.slug)].slice(0, 6);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}
