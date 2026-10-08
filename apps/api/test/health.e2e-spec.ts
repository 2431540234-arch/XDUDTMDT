import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { IsEmail, IsInt, Min } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CurrentUser, Roles, type RequestUser } from '../src/common/decorators/auth.decorators';

class ProbeDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

// Controller chỉ dùng trong test để thử guard/validation (module nghiệp vụ thật chưa có ở giai đoạn nền tảng)
@Controller('probe')
class ProbeController {
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Roles('admin')
  @Get('admin')
  admin() {
    return { ok: true };
  }

  @Post('validate')
  validate(@Body() dto: ProbeDto) {
    return dto;
  }
}

describe('Foundation (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const tokenFor = (id: number, roles: string[]) =>
    jwt.sign({ sub: id, roles }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health -> 200 theo định dạng chuẩn, kiểm tra DB', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.checks.database).toBe('up');
  });

  it('endpoint không tồn tại -> 404 RESOURCE_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer()).get('/api/khong-ton-tai').expect(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'RESOURCE_NOT_FOUND' } });
  });

  it('dữ liệu sai -> 400 VALIDATION_FAILED, details theo từng trường', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/probe/validate')
      .set('Authorization', `Bearer ${tokenFor(1, ['user'])}`)
      .send({ email: 'khong-phai-email', quantity: 0, thua: 1 })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.email).toEqual(['Email không hợp lệ']);
    expect(res.body.error.details.quantity).toBeDefined();
    expect(res.body.error.details.thua).toBeDefined();
  });

  it('không có token -> 401 AUTH_UNAUTHENTICATED', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe/me').expect(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'AUTH_UNAUTHENTICATED' } });
  });

  it('token sai -> 401 AUTH_TOKEN_INVALID', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/probe/me')
      .set('Authorization', 'Bearer abc.def.ghi')
      .expect(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('token hợp lệ -> @CurrentUser trả đúng user, bọc trong data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/probe/me')
      .set('Authorization', `Bearer ${tokenFor(7, ['user'])}`)
      .expect(200);
    expect(res.body).toEqual({ success: true, data: { id: 7, roles: ['user'] } });
  });

  it('@Roles("admin"): user -> 403 FORBIDDEN, admin -> 200', async () => {
    const asUser = await request(app.getHttpServer())
      .get('/api/probe/admin')
      .set('Authorization', `Bearer ${tokenFor(7, ['user'])}`)
      .expect(403);
    expect(asUser.body.error.code).toBe('FORBIDDEN');

    await request(app.getHttpServer())
      .get('/api/probe/admin')
      .set('Authorization', `Bearer ${tokenFor(1, ['admin'])}`)
      .expect(200);
  });
});
