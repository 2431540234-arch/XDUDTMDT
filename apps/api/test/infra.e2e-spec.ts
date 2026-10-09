// E2E hạ tầng dùng chung: /health đầy đủ, throttler nhóm auth, CacheService trên Redis thật,
// email qua queue `mail` tới Mailpit, Bull Board hiển thị đủ 4 queue.
import { randomUUID } from 'node:crypto';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CacheService } from '../src/cache/cache.service';
import { AuthThrottle } from '../src/common/decorators/throttle.decorators';
import { Public } from '../src/common/decorators/auth.decorators';
import { MAIL_SERVICE, type MailService } from '../src/mail/mail.service';

// Controller chỉ dùng trong test, mô phỏng route xác thực (M02 sẽ gắn @AuthThrottle() thật)
@Controller('probe-auth')
class ProbeAuthController {
  @Public()
  @AuthThrottle()
  @Get('limited')
  limited() {
    return { ok: true };
  }

  @Public()
  @Get('free')
  free() {
    return { ok: true };
  }
}

const MAILPIT = process.env.MAILPIT_API_URL ?? `http://localhost:${process.env.MAILPIT_UI_PORT ?? '8025'}`;

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Hết thời gian chờ điều kiện');
    await new Promise((r) => setTimeout(r, 300));
  }
}

describe('Hạ tầng dùng chung (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    // Xóa bộ đếm throttler của lần chạy trước (TTL 60 giây) để test lặp lại được ngay
    const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) });
    const keys = await redis.keys('throttle-test:*');
    if (keys.length) await redis.del(...keys);
    redis.disconnect();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeAuthController],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    adminToken = app
      .get(JwtService)
      .sign({ sub: 1, roles: ['admin'] }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health báo database, redis, storage, smtp, queues đều up và số job của 4 queue', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.data.checks).toEqual({
      database: 'up',
      redis: 'up',
      storage: 'up',
      smtp: 'up',
      queues: 'up',
    });
    expect(Object.keys(res.body.data.queues).sort()).toEqual(
      ['image-processing', 'mail', 'model-processing', 'notification'].sort(),
    );
    expect(res.body.data.queues.mail).toEqual({
      waiting: expect.any(Number),
      active: expect.any(Number),
      delayed: expect.any(Number),
      failed: expect.any(Number),
    });
  });

  it('throttler nhóm auth: route gắn @AuthThrottle() bị 429 sau THROTTLE_AUTH_LIMIT lần, route khác không bị', async () => {
    const limit = Number(process.env.THROTTLE_AUTH_LIMIT);
    for (let i = 0; i < limit; i++) {
      await request(app.getHttpServer()).get('/api/probe-auth/limited').expect(200);
    }
    const blocked = await request(app.getHttpServer()).get('/api/probe-auth/limited').expect(429);
    expect(blocked.body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });

    for (let i = 0; i < limit + 3; i++) {
      await request(app.getHttpServer()).get('/api/probe-auth/free').expect(200);
    }
  });

  it('CacheService trên Redis thật: set/get/del/delByPrefix, khóa có tiền tố, TTL', async () => {
    const cache = app.get(CacheService);
    const p = `e2e-${randomUUID()}:`;
    await cache.set(`${p}a`, { x: 1 }, 30);
    await cache.set(`${p}b`, 'hai', 30);
    await expect(cache.get(`${p}a`)).resolves.toEqual({ x: 1 });
    await expect(cache.delByPrefix(p)).resolves.toBe(2);
    await expect(cache.get(`${p}a`)).resolves.toBeNull();
    await cache.set(`${p}c`, 1, 30);
    await cache.del(`${p}c`);
    await expect(cache.get(`${p}c`)).resolves.toBeNull();
  });

  it('gửi email qua queue `mail` -> worker -> Mailpit nhận được', async () => {
    const mail = app.get<MailService>(MAIL_SERVICE);
    const subject = `Kiểm tra queue mail ${randomUUID()}`;
    const to = `khach-${Date.now()}@test.local`;
    await mail.send({ to, subject, html: '<p>Xin chào từ <b>Aurelia Living</b></p>', text: 'Xin chào' });

    const found = await waitFor(async () => {
      const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${subject}"`)}`);
      const body = (await r.json()) as {
        messages?: { ID: string; Subject: string; To: { Address: string }[] }[];
      };
      return body.messages?.find((m) => m.Subject === subject);
    });
    expect(found.To[0].Address).toBe(to);

    // Dọn thư thử trong Mailpit
    await fetch(`${MAILPIT}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: [found.ID] }),
    });
  });

  it('Bull Board hiển thị đủ 4 queue cho admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/queues/api/queues')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const names = (res.body.queues as { name: string }[]).map((q) => q.name).sort();
    expect(names).toEqual(['image-processing', 'mail', 'model-processing', 'notification']);
  });
});
