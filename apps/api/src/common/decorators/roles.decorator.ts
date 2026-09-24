// Decorator đánh dấu route yêu cầu 1 hoặc nhiều role cụ thể mới được truy cập
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
