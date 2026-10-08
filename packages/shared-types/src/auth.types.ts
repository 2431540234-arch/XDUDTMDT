// Kiểu dùng chung cho xác thực. Vai trò chỉ có hai: admin và user (khách vãng lai không có tài khoản).
import type { User } from './entities.generated';

export type RoleCode = 'admin' | 'user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Người dùng hiện tại (gắn vào request sau khi xác thực, và trả về khi đăng nhập). */
export interface AuthUser extends Pick<User, 'id' | 'uuid' | 'email' | 'fullName' | 'status'> {
  roles: RoleCode[];
}
