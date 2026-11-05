// Bảng `user_roles`: user #1 = admin; còn lại = user
import type { UserRole } from '@aurelia-living/shared-types';
import { users } from './users';

export const userRoles: UserRole[] = users.map((u) => ({
  userId: u.id,
  roleId: u.id === 1 ? 1 : 2,
  createdAt: u.createdAt,
}));
