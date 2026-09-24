// Guard kiểm tra quyền (role) của người dùng trước khi vào route
// Chạy sau JwtAuthGuard trong @UseGuards(JwtAuthGuard, RolesGuard) nên request.user đã có sẵn
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) {
      return false;
    }

    return requiredRoles.some((role) => role.toLowerCase() === String(user.role).toLowerCase());
  }
}
