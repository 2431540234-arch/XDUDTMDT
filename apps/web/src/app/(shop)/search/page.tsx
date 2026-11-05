// Kết quả tìm kiếm (WIREFRAME 2.13) – /search?q=
import { Suspense } from 'react';
import ProductListing from '@/components/product/ProductListing';

export const metadata = { title: 'Kết quả tìm kiếm – Aurelia Living' };

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <ProductListing mode="search" />
    </Suspense>
  );
}
