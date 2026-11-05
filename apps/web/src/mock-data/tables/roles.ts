// Bảng `roles` – chỉ 2 vai trò: admin (Doanh nghiệp) và user (Khách hàng). Khớp seed.ts / DECISIONS D-P02.
import type { Role } from '@aurelia-living/shared-types';

export const roles: Role[] = [
  {
    id: 1,
    code: 'admin',
    name: 'Doanh nghiệp (Quản trị)',
    description: 'Quản trị cửa hàng trong Admin Panel',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    code: 'user',
    name: 'Khách hàng',
    description: 'Người mua hàng',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
