// DTO định dạng dữ liệu user trả về cho client - khớp field types/user.d.ts phía frontend
import type { User } from "@prisma/client";

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.toLowerCase() as "customer" | "admin",
  };
}
