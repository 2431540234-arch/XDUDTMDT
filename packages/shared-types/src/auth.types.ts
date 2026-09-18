// Định nghĩa các kiểu dữ liệu dùng chung cho xác thực người dùng (User, token...)

export interface User {
  id: string;
  email: string;
  name: string;
  role: "customer" | "admin";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
