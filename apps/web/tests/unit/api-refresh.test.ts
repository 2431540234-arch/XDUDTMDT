import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, http } from '../../src/services/api-client';
import { useAuthStore } from '../../src/store/authStore';

// Luồng token hết hạn: 401 ⇒ tự gọi /auth/refresh một lần (kể cả khi nhiều request song song) ⇒ gửi lại request.
const user = {
  id: 1,
  uuid: 'u',
  email: 'a@b.vn',
  fullName: 'A',
  roles: ['user'],
  avatarUrl: null,
  phone: null,
} as never;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const expired = () =>
  json(401, { success: false, error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Phiên đã hết hạn.' } });

describe('api-client: tự làm mới access token', () => {
  const calls: Array<{ url: string; auth: string | null }> = [];

  beforeEach(() => {
    calls.length = 0;
    useAuthStore.setState({ user, accessToken: 'old-access', refreshToken: 'old-refresh', hydrated: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  const stub = (handler: (url: string, headers: Headers) => Response) =>
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url, auth: headers.get('Authorization') });
      return handler(url, headers);
    });

  it('401 hết hạn ⇒ refresh một lần, lưu cặp token mới, gửi lại request với token mới', async () => {
    stub((url, h) => {
      if (url.endsWith('/auth/refresh'))
        return json(200, {
          success: true,
          data: { user, tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } },
        });
      return h.get('Authorization') === 'Bearer new-access'
        ? json(200, { success: true, data: { ok: true } })
        : expired();
    });
    await expect(http.get<{ ok: boolean }>('/orders')).resolves.toEqual({ ok: true });
    expect(useAuthStore.getState().accessToken).toBe('new-access');
    expect(useAuthStore.getState().refreshToken).toBe('new-refresh');
    expect(calls.map((c) => c.url.split('/api')[1])).toEqual(['/orders', '/auth/refresh', '/orders']);
  });

  it('nhiều request song song cùng hết hạn ⇒ chỉ gọi /auth/refresh đúng 1 lần', async () => {
    stub((url, h) => {
      if (url.endsWith('/auth/refresh'))
        return json(200, {
          success: true,
          data: { user, tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } },
        });
      return h.get('Authorization') === 'Bearer new-access'
        ? json(200, { success: true, data: [] })
        : expired();
    });
    await Promise.all([http.get('/orders'), http.get('/wishlist'), http.get('/notifications')]);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(calls.filter((c) => c.auth === 'Bearer new-access')).toHaveLength(3);
  });

  it('refresh thất bại ⇒ đăng xuất cục bộ và ném lỗi 401, không lặp vô hạn', async () => {
    stub((url) =>
      url.endsWith('/auth/refresh')
        ? json(401, { success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Phiên không hợp lệ.' } })
        : expired(),
    );
    await expect(http.get('/orders')).rejects.toMatchObject({ status: 401 });
    await expect(http.get('/orders')).rejects.toBeInstanceOf(ApiClientError);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('đăng nhập sai (401 ở /auth/login) không kích hoạt refresh', async () => {
    stub(() => json(401, { success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Sai.' } }));
    await expect(http.post('/auth/login', { email: 'a@b.vn', password: 'x' })).rejects.toMatchObject({
      status: 401,
    });
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(0);
  });
});

describe('ApiClientError.fieldErrors', () => {
  it('VALIDATION_FAILED và CONFLICT (slug trùng) trả lỗi theo ô; CONFLICT bỏ qua khóa không phải mảng chuỗi (unavailable)', async () => {
    const { ApiClientError } = await import('../../src/services/api-client');
    expect(new ApiClientError('VALIDATION_FAILED', 'm', 400, { title: ['Thiếu'] }).fieldErrors()).toEqual({
      title: 'Thiếu',
    });
    expect(new ApiClientError('CONFLICT', 'm', 409, { slug: ['Slug đã tồn tại.'] }).fieldErrors()).toEqual({
      slug: 'Slug đã tồn tại.',
    });
    expect(new ApiClientError('CONFLICT', 'm', 409, { unavailable: [{ name: 'A' }] }).fieldErrors()).toEqual(
      {},
    );
    expect(new ApiClientError('BAD_REQUEST', 'm', 400, { x: ['y'] }).fieldErrors()).toEqual({});
  });
});
