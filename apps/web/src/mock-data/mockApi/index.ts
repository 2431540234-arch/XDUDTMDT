// Bộ định tuyến mock API: cùng URL/method/tham số/định dạng response như Backend thật (docs/API_CONVENTIONS.md).
// Được gọi từ src/services/api-client.ts khi NEXT_PUBLIC_USE_MOCK=true. Chạy hoàn toàn trong trình duyệt.
import { ERROR_HTTP_STATUS, type ApiResult } from '@aurelia-living/shared-types';
import { getConfig, getDb, resetDb, saveDb } from '../db';
import * as admin from './admin';
import * as auth from './auth';
import * as catalog from './catalog';
import { ApiFail, type Ctx, type DbUser, type Query, type Result } from './http';
import * as shop from './shop';

type Access = 'public' | 'user' | 'admin';
type Handler = (ctx: Ctx) => Result;
type Route = [method: string, path: string, access: Access, handler: Handler];

const routes: Route[] = [
  // ----- Xác thực -----
  ['POST', '/auth/login', 'public', auth.login],
  ['POST', '/auth/register', 'public', auth.register],
  ['POST', '/auth/logout', 'public', () => ({ data: null })],
  ['POST', '/auth/refresh', 'public', auth.refresh],
  ['POST', '/auth/verify-email', 'public', auth.verifyEmail],
  ['POST', '/auth/resend-verification', 'user', auth.resendVerification],
  ['POST', '/auth/forgot-password', 'public', auth.forgotPassword],
  ['POST', '/auth/reset-password', 'public', auth.resetPassword],
  ['POST', '/auth/google', 'public', auth.googleLogin],
  ['GET', '/users/me', 'user', auth.me],
  ['PATCH', '/users/me', 'user', auth.updateMe],
  ['POST', '/users/me/change-password', 'user', auth.changePassword],
  ['GET', '/addresses', 'user', auth.listAddresses],
  ['POST', '/addresses', 'user', auth.createAddress],
  ['PATCH', '/addresses/:id/default', 'user', auth.setDefaultAddress],
  ['PATCH', '/addresses/:id', 'user', auth.updateAddress],
  ['DELETE', '/addresses/:id', 'user', auth.deleteAddress],

  // ----- Danh mục, sản phẩm -----
  ['GET', '/categories', 'public', catalog.categories],
  ['GET', '/brands', 'public', catalog.brands],
  ['GET', '/products', 'public', catalog.products],
  ['GET', '/products/search', 'public', catalog.searchProducts],
  ['GET', '/products/facets', 'public', catalog.facets],
  ['GET', '/products/:slug', 'public', catalog.productDetailHandler],
  ['GET', '/products/:slug/model', 'public', catalog.productModel],
  ['GET', '/products/:slug/360', 'public', catalog.product360],
  ['GET', '/products/:slug/related', 'public', catalog.relatedProducts],
  ['GET', '/products/:slug/reviews', 'public', catalog.productReviews],
  ['POST', '/products/:slug/reviews', 'user', catalog.createReview],
  ['GET', '/products/:slug/questions', 'public', catalog.productQuestions],
  ['POST', '/products/:slug/questions', 'user', catalog.askQuestion],
  ['GET', '/wishlist', 'user', catalog.wishlist],
  ['PUT', '/wishlist/:slug', 'user', catalog.addWishlist],
  ['DELETE', '/wishlist/:slug', 'user', catalog.removeWishlist],
  ['GET', '/reviews/me', 'user', catalog.myReviews],
  ['PATCH', '/reviews/:id', 'user', catalog.updateReview],
  ['DELETE', '/reviews/:id', 'user', catalog.deleteReview],

  // ----- Không gian mẫu -----
  ['GET', '/spaces', 'public', catalog.spaces],
  ['GET', '/spaces/facets', 'public', catalog.spaceFacets],
  ['GET', '/spaces/:slug', 'public', catalog.spaceBySlug],
  ['POST', '/spaces/:slug/views', 'public', catalog.recordSpaceView],
  ['PUT', '/spaces/:slug/bookmark', 'user', catalog.bookmarkSpace],
  ['DELETE', '/spaces/:slug/bookmark', 'user', catalog.unbookmarkSpace],

  // ----- Giỏ hàng, đơn hàng, thanh toán, đổi trả -----
  ['GET', '/cart', 'user', shop.getCart],
  ['DELETE', '/cart', 'user', shop.clearCart],
  ['POST', '/cart/items', 'user', shop.addCartItem],
  ['PATCH', '/cart/items/:id', 'user', shop.updateCartItem],
  ['DELETE', '/cart/items/:id', 'user', shop.removeCartItem],
  ['POST', '/cart/coupon', 'user', shop.applyCoupon],
  ['DELETE', '/cart/coupon', 'user', shop.removeCoupon],
  ['POST', '/orders', 'user', shop.createOrder],
  ['GET', '/orders', 'user', shop.listOrders],
  ['GET', '/orders/counts', 'user', shop.orderCounts],
  ['GET', '/orders/:code', 'user', shop.orderDetail],
  ['POST', '/orders/:id/cancel', 'user', shop.cancelOrder],
  ['POST', '/payments/:orderId/checkout', 'user', shop.checkoutPayment],
  ['POST', '/payments/:orderId/retry', 'user', shop.retryPayment],
  ['GET', '/returns', 'user', shop.listReturns],
  ['POST', '/returns', 'user', shop.createReturn],
  ['GET', '/coupons/me', 'user', catalog.myCoupons],
  ['GET', '/coupons/suggested', 'user', catalog.suggestedCoupons],
  ['POST', '/coupons/save', 'user', catalog.saveCoupon],

  // ----- Thông báo, nội dung -----
  ['GET', '/notifications', 'user', catalog.notifications],
  ['GET', '/notifications/unread-count', 'user', catalog.unreadCount],
  ['PATCH', '/notifications/read-all', 'user', catalog.markAllRead],
  ['PATCH', '/notifications/:id/read', 'user', catalog.markRead],
  ['GET', '/banners', 'public', catalog.banners],
  ['GET', '/posts', 'public', catalog.posts],
  ['GET', '/pages', 'public', catalog.policies],
  ['GET', '/pages/:slug', 'public', catalog.pageBySlug],
  ['GET', '/faq', 'public', catalog.faq],
  ['POST', '/contact', 'public', catalog.contact],
  ['GET', '/settings/public', 'public', catalog.publicSettings],

  // ----- Admin -----
  ['GET', '/admin/stats/overview', 'admin', admin.overview],
  ['GET', '/admin/stats/finance', 'admin', admin.finance],
  ['GET', '/admin/notifications', 'admin', admin.adminNotifications],
  ['GET', '/admin/search', 'admin', admin.adminSearch],
  ['GET', '/admin/products', 'admin', admin.adminProducts],
  ['POST', '/admin/products', 'admin', admin.createProduct],
  ['GET', '/admin/products/:id', 'admin', admin.adminProduct],
  ['GET', '/admin/products/:id/360', 'admin', admin.adminProduct360],
  ['PUT', '/admin/products/:id/360', 'admin', admin.saveProduct360],
  ['PATCH', '/admin/products/:id', 'admin', admin.updateProduct],
  ['DELETE', '/admin/products/:id', 'admin', admin.deleteProduct],
  ['GET', '/admin/categories', 'admin', admin.adminCategories],
  ['POST', '/admin/categories', 'admin', admin.createCategory],
  ['PATCH', '/admin/categories/:id', 'admin', admin.updateCategory],
  ['DELETE', '/admin/categories/:id', 'admin', admin.deleteCategory],
  ['GET', '/admin/orders', 'admin', admin.adminOrders],
  ['POST', '/admin/orders', 'admin', admin.adminCreateOrder],
  ['GET', '/admin/orders/counts', 'admin', admin.adminOrderCounts],
  ['GET', '/admin/orders/:code', 'admin', admin.adminOrder],
  ['PATCH', '/admin/orders/:id/status', 'admin', admin.setOrderStatus],
  ['POST', '/admin/orders/:id/cancel', 'admin', admin.cancelOrder],
  ['POST', '/admin/orders/:id/refund', 'admin', admin.refundOrder],
  ['PATCH', '/admin/orders/:id/shipment', 'admin', admin.updateShipment],
  ['PATCH', '/admin/orders/:id/note', 'admin', admin.saveOrderNote],
  ['PATCH', '/admin/payments/:id/confirm', 'admin', admin.confirmPayment],
  ['GET', '/admin/returns', 'admin', admin.adminReturns],
  ['PATCH', '/admin/returns/:id', 'admin', admin.updateReturn],
  ['GET', '/admin/users', 'admin', admin.adminCustomers],
  ['POST', '/admin/users', 'admin', admin.createCustomer],
  ['GET', '/admin/users/:id', 'admin', admin.adminCustomer],
  ['PATCH', '/admin/users/:id', 'admin', admin.updateCustomer],
  ['PATCH', '/admin/users/:id/status', 'admin', admin.setCustomerStatus],
  ['GET', '/admin/users/:id/orders', 'admin', admin.customerOrders],
  ['GET', '/admin/users/:id/reviews', 'admin', admin.customerReviews],
  ['GET', '/admin/users/:id/wishlist', 'admin', admin.customerWishlist],
  ['GET', '/admin/reviews', 'admin', admin.adminReviews],
  ['PATCH', '/admin/reviews/:id/status', 'admin', admin.setReviewStatus],
  ['GET', '/admin/questions', 'admin', admin.adminQuestions],
  ['PATCH', '/admin/questions/:id', 'admin', admin.answerQuestion],
  ['GET', '/admin/models', 'admin', admin.adminModels],
  ['POST', '/admin/models', 'admin', admin.uploadModel],
  ['DELETE', '/admin/models/:id', 'admin', admin.deleteModel],
  ['GET', '/admin/coupons', 'admin', admin.adminCoupons],
  ['POST', '/admin/coupons', 'admin', admin.createCoupon],
  ['GET', '/admin/coupons/:id', 'admin', admin.adminCoupon],
  ['PATCH', '/admin/coupons/:id', 'admin', admin.updateCoupon],
  ['DELETE', '/admin/coupons/:id', 'admin', admin.deleteCoupon],
  ['GET', '/admin/spaces', 'admin', admin.adminSpaces],
  ['POST', '/admin/spaces', 'admin', admin.createSpace],
  ['GET', '/admin/spaces/:id', 'admin', admin.adminSpace],
  ['PATCH', '/admin/spaces/:id', 'admin', admin.updateSpace],
  ['DELETE', '/admin/spaces/:id', 'admin', admin.deleteSpace],
  ['GET', '/admin/banners', 'admin', admin.adminBanners],
  ['POST', '/admin/banners', 'admin', admin.saveBanner],
  ['PATCH', '/admin/banners/:id', 'admin', admin.saveBanner],
  ['DELETE', '/admin/banners/:id', 'admin', admin.deleteBanner],
  ['GET', '/admin/posts', 'admin', admin.adminPosts],
  ['POST', '/admin/posts', 'admin', admin.savePost],
  ['PATCH', '/admin/posts/:id', 'admin', admin.savePost],
  ['DELETE', '/admin/posts/:id', 'admin', admin.deletePost],
  ['GET', '/admin/pages', 'admin', admin.adminPages],
  ['PATCH', '/admin/pages/:id', 'admin', admin.savePage],
  ['GET', '/admin/settings', 'admin', admin.getSettings],
  ['PUT', '/admin/settings/store', 'admin', admin.saveSettings],
  ['POST', '/admin/settings/reset-mock', 'admin', admin.resetMock],
  ['GET', '/admin/inventory', 'admin', admin.adminInventory],
  ['GET', '/admin/inventory/summary', 'admin', admin.inventorySummary],
  ['GET', '/admin/inventory/receipts', 'admin', admin.receipts],
  ['POST', '/admin/inventory/receipts', 'admin', admin.createReceipt],
  ['POST', '/admin/inventory/receipts/:id/confirm', 'admin', admin.confirmReceipt],
  ['POST', '/admin/inventory/receipts/:id/cancel', 'admin', admin.cancelReceipt],
  ['GET', '/admin/inventory/movements', 'admin', admin.stockMovements],
  ['POST', '/admin/expenses', 'admin', admin.createExpense],
];

const compiled = routes.map(([method, path, access, handler]) => ({
  method,
  access,
  handler,
  keys: [...path.matchAll(/:(\w+)/g)].map((m) => m[1]),
  re: new RegExp(`^${path.replace(/:(\w+)/g, '([^/]+)')}$`),
}));

let bootstrapped = false;
function bootstrap() {
  if (bootstrapped || typeof window === 'undefined') return;
  bootstrapped = true;
  const url = new URL(window.location.href);
  if (url.searchParams.get('resetMock') === '1') {
    resetDb();
    url.searchParams.delete('resetMock');
    window.history.replaceState(null, '', url.toString());
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function userFromToken(token: string | null, ctx: Pick<Ctx, 'db'>): DbUser | null {
  const m = token?.match(/^mock\.(\d+)\./);
  if (!m) return null;
  return ctx.db.users.find((u) => u.id === Number(m[1]) && !u.deletedAt) ?? null;
}

export interface MockRequest {
  method: string;
  path: string;
  query: Query;
  body: unknown;
  token: string | null;
}

export async function handleMockRequest(
  req: MockRequest,
): Promise<{ status: number; body: ApiResult<unknown> }> {
  bootstrap();
  const cfg = getConfig();
  if (cfg.latency) await sleep(200 + Math.random() * 300);
  const db = getDb();
  const method = req.method.toUpperCase();
  const path = req.path.replace(/\/+$/, '') || '/';

  const fail = (
    code: keyof typeof ERROR_HTTP_STATUS,
    message: string,
    details?: Record<string, unknown>,
  ) => ({
    status: ERROR_HTTP_STATUS[code],
    body: { success: false as const, error: { code, message, ...(details ? { details } : {}) } },
  });

  try {
    const route = compiled.find((r) => r.method === method && r.re.test(path));
    if (!route) return fail('RESOURCE_NOT_FOUND', 'Đường dẫn không tồn tại.');

    const isAuthRoute = path.startsWith('/auth/');
    if (
      !isAuthRoute &&
      (cfg.forceError && method === 'GET' ? true : cfg.errorRate > 0 && Math.random() < cfg.errorRate)
    ) {
      return fail('INTERNAL_ERROR', 'Máy chủ gặp sự cố (giả lập lỗi). Vui lòng thử lại.');
    }

    const params: Record<string, string> = {};
    const match = path.match(route.re)!;
    route.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));

    const ctx: Ctx = { db, user: userFromToken(req.token, { db }), params, query: req.query, body: req.body };
    if (route.access !== 'public') {
      if (!ctx.user) throw new ApiFail('AUTH_UNAUTHENTICATED', 'Vui lòng đăng nhập để tiếp tục.');
      if (ctx.user.status !== 'active')
        throw new ApiFail('AUTH_ACCOUNT_LOCKED', 'Tài khoản của bạn đang bị khóa.');
      if (route.access === 'admin' && !db.userRoles.some((r) => r.userId === ctx.user!.id && r.roleId === 1))
        throw new ApiFail('FORBIDDEN', 'Bạn không có quyền truy cập khu vực quản trị.');
    }

    const result = route.handler(ctx);
    if (method !== 'GET') saveDb();
    else if (path === '/products/:slug') saveDb();
    const data = result.data === undefined ? null : JSON.parse(JSON.stringify(result.data));
    return {
      status: result.status ?? 200,
      body: { success: true, data, ...(result.meta ? { meta: result.meta } : {}) },
    };
  } catch (e) {
    if (e instanceof ApiFail) return fail(e.code, e.message, e.details);
    console.error('[mock-api]', e);
    return fail('INTERNAL_ERROR', 'Lỗi không xác định trong mock API.');
  }
}

export { getConfig, resetDb };
