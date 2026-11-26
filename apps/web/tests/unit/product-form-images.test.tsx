// Lưu sản phẩm ở trang admin không được làm mất ảnh gắn màu (biến thể).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductForm from '@/components/admin/ProductForm';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/useProducts', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('@/services/admin.api', () => ({
  adminApi: {
    products: { get: mocks.get, update: mocks.update, create: vi.fn() },
    attributes: { list: async () => [] },
  },
}));

const variant = (id: number, color: string, size: string) => ({
  id,
  sku: `SOFA-${id}`,
  color: { name: color, hex: '#999999' },
  size,
  price: 5_000_000,
  salePrice: null,
  stockQuantity: 3,
  isActive: true,
});
const image = (id: number, variantId: number | null, isPrimary = false) => ({
  id,
  mediaId: 100 + id,
  url: `/img/${id}.webp`,
  isPrimary,
  sortOrder: id,
  variantId,
});
const IMAGES = [image(1, 11, true), image(2, null), image(3, 21), image(4, 12)];
const PRODUCT = {
  id: 7,
  name: 'Sofa thử',
  slug: 'sofa-thu',
  sku: 'SOFA-11',
  categoryId: 3,
  status: 'published',
  brand: null,
  price: 5_000_000,
  salePrice: null,
  stockQuantity: 9,
  shortDescription: 'Mô tả ngắn',
  description: '',
  material: null,
  style: '',
  features: [],
  model: null,
  images: IMAGES,
  // hai biến thể cùng màu Xám (khác cỡ) và một biến thể màu Nâu
  variants: [variant(11, 'Xám', '2m'), variant(12, 'Xám', '2m4'), variant(21, 'Nâu', '2m')],
};

type Sent = {
  images: Array<{ mediaId?: number; variantId?: number | null; isPrimary: boolean; url: string }>;
  removedImageIds?: number[];
};

async function openImagesTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProductForm productId={7} />
    </QueryClientProvider>,
  );
  await screen.findByDisplayValue('Sofa thử');
  fireEvent.click(screen.getByRole('tab', { name: 'Hình ảnh' }));
}

async function save(): Promise<Sent> {
  fireEvent.click(screen.getByRole('button', { name: 'Lưu sản phẩm' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
  return mocks.update.mock.calls[0][1] as Sent;
}

const group = (name: string) => screen.getByRole('group', { name });
const sources = (el: HTMLElement) =>
  within(el)
    .getAllByRole('img')
    .map((i) => i.getAttribute('src'));

describe('ProductForm: ảnh gắn màu', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue(PRODUCT);
    mocks.update.mockReset().mockResolvedValue(PRODUCT);
  });

  it('lưu mà không đổi ảnh ⇒ gửi đủ mọi ảnh, giữ nguyên liên kết biến thể và ảnh đại diện', async () => {
    await openImagesTab();
    const body = await save();
    expect(body.images.map((i) => [i.mediaId, i.variantId, i.isPrimary])).toEqual([
      [101, 11, true],
      [102, null, false],
      [103, 21, false],
      [104, 12, false],
    ]);
    expect(body.removedImageIds).toEqual([]);
  });

  it('hiện ảnh theo nhóm: ảnh chung và từng màu (gộp các cỡ cùng màu)', async () => {
    await openImagesTab();
    expect(sources(group('Ảnh chung'))).toEqual(['/img/2.webp']);
    expect(sources(group('Màu Xám'))).toEqual(['/img/1.webp', '/img/4.webp']);
    expect(sources(group('Màu Nâu'))).toEqual(['/img/3.webp']);
  });

  it('xóa một ảnh gắn màu ⇒ chỉ ảnh đó nằm trong removedImageIds', async () => {
    await openImagesTab();
    fireEvent.click(within(group('Màu Nâu')).getByRole('button', { name: 'Xóa ảnh' }));
    const body = await save();
    expect(body.removedImageIds).toEqual([3]);
    expect(body.images.map((i) => i.mediaId)).toEqual([101, 102, 104]);
  });

  it('đổi thứ tự trong một nhóm không làm ảnh nhảy sang nhóm khác', async () => {
    await openImagesTab();
    fireEvent.click(within(group('Màu Xám')).getAllByRole('button', { name: 'Lên' })[1]);
    const body = await save();
    expect(body.images.map((i) => [i.mediaId, i.variantId])).toEqual([
      [104, 12],
      [102, null],
      [103, 21],
      [101, 11],
    ]);
  });
});

describe('mock API: lưu sản phẩm giữ ảnh gắn màu', () => {
  it('chỉ gỡ ảnh trong removedImageIds; ảnh khác giữ nguyên dòng và biến thể', async () => {
    const { handleMockRequest } = await import('@/mock-data/mockApi');
    localStorage.setItem('aurelia-mock-config', JSON.stringify({ latency: false }));
    const call = async (method: string, path: string, body?: unknown, token: string | null = null) => {
      const r = await handleMockRequest({ method, path, query: {}, body, token });
      return (r.body as unknown as { data: never }).data;
    };
    const login = (await call('POST', '/auth/login', {
      email: 'admin@aurelia.vn',
      password: 'admin123',
    })) as { tokens: { accessToken: string } };
    const token = login.tokens.accessToken;
    type P = typeof PRODUCT;
    const list = (await call('GET', '/admin/products', undefined, token)) as unknown as Array<{ id: number }>;
    let target: P | undefined;
    for (const row of list) {
      const p = (await call('GET', `/admin/products/${row.id}`, undefined, token)) as unknown as P;
      if (p.images.some((i) => i.variantId !== null) && p.images.length > 1) {
        target = p;
        break;
      }
    }
    expect(target, 'mock phải có sản phẩm có ảnh gắn màu').toBeDefined();
    const t = target!;
    const key = (p: P) => p.images.map((i) => [i.id, i.variantId, i.url]);
    const body = {
      ...t,
      price: t.price,
      stock: 5,
      shortDescription: 'Mô tả ngắn',
      variants: t.variants.filter((v) => v.isActive),
    };
    const common = t.images.filter((i) => i.variantId === null);
    const same = (await call(
      'PATCH',
      `/admin/products/${t.id}`,
      { ...body, images: common.map((i) => ({ url: i.url, isPrimary: i.isPrimary })) },
      token,
    )) as unknown as P;
    expect(key(same)).toEqual(key(t));

    const gone = t.images.find((i) => i.variantId !== null && !i.isPrimary)!;
    const after = (await call(
      'PATCH',
      `/admin/products/${t.id}`,
      { ...body, images: [], removedImageIds: [gone.id] },
      token,
    )) as unknown as P;
    expect(key(after)).toEqual(key(t).filter(([id]) => id !== gone.id));
  });
});
