'use client';

// Sửa sản phẩm (WIREFRAME 3.2b)
import { useParams } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductForm productId={Number(id)} />;
}
