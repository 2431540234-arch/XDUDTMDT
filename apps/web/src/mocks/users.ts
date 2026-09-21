// Dữ liệu tài khoản mock tạm thời cho luồng đăng nhập/đăng ký - cần nối API thật (auth.api.ts) sau này
import type { MockUserRecord } from "@/types/user";

export const mockUsers: MockUserRecord[] = [
  {
    id: "u1",
    name: "Khách demo",
    email: "demo@aurelialiving.vn",
    password: "123456",
    role: "customer",
  },
];
