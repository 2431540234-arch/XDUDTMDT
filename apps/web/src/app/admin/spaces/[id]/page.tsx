'use client';

// Sửa không gian mẫu
import { useParams } from 'next/navigation';
import SpaceForm from '@/components/admin/SpaceForm';

export default function EditSpacePage() {
  const { id } = useParams<{ id: string }>();
  return <SpaceForm spaceId={Number(id)} />;
}
