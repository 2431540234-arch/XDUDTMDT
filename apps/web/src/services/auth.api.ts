// Gọi API xác thực - hiện dùng mock data, cần thay bằng fetch tới apiClient khi có API thật
import { mockUsers } from "@/mocks/users";
import type { User } from "@/types/user";

// Bản sao trong bộ nhớ để lưu user đăng ký mới trong phiên làm việc hiện tại
const users = [...mockUsers];

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginRequest(email: string, password: string): Promise<User> {
  await delay();
  const found = users.find((u) => u.email === email && u.password === password);
  if (!found) {
    throw new Error("Email hoặc mật khẩu không đúng.");
  }
  const { password: _password, ...user } = found;
  return user;
}

export async function registerRequest(name: string, email: string, password: string): Promise<User> {
  await delay();
  if (users.some((u) => u.email === email)) {
    throw new Error("Email này đã được đăng ký.");
  }
  const newUser = { id: `u${users.length + 1}`, name, email, password, role: "customer" as const };
  users.push(newUser);
  const { password: _password, ...user } = newUser;
  return user;
}
