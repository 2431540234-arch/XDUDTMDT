'use client';

// Sửa khuyến mãi
import { useParams } from 'next/navigation';
import PromotionForm from '@/components/admin/PromotionForm';

export default function EditPromotionPage() {
  const { id } = useParams<{ id: string }>();
  return <PromotionForm couponId={Number(id)} />;
}
