// Khai báo kiểu dữ liệu cục bộ liên quan đến người dùng cho web

export type UserRole = "customer" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface MockUserRecord extends User {
  password: string;
}
