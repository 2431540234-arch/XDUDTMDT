// Danh sách sản phẩm (WIREFRAME 2.2) – /products, /products?category=sofa
import { Suspense } from 'react';
import ProductListing from '@/components/product/ProductListing';

export const metadata = { title: 'Sản phẩm – Aurelia Living' };

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductListing mode="list" />
    </Suspense>
  );
}
