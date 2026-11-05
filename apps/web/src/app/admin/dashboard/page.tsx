// Đường dẫn cũ /admin/dashboard → chuyển về /admin (WIREFRAME mục 4: Tổng quan nằm ở /admin)
import { redirect } from 'next/navigation';

export default function AdminDashboardRedirect() {
  redirect('/admin');
}
