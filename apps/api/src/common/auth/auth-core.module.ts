import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

/** Cung cấp JwtService cho guard toàn cục. Module auth (đăng nhập/đăng ký) sẽ ký token bằng chính JwtService này. */
@Global()
@Module({ imports: [JwtModule.register({})], exports: [JwtModule] })
export class AuthCoreModule {}
