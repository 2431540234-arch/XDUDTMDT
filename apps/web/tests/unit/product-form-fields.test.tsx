// Lưu sản phẩm ở trang admin: không được làm mất giá trị mà admin không sửa (cờ nổi bật, chất liệu, mã màu…).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductForm from '@/components/admin/ProductForm';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/useProducts', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('@/services/admin.api', () => ({
  adminApi: {
    products: { get: mocks.get, update: mocks.update, create: mocks.create },
    attributes: {
      list: async () => [
        {
          code: 'color',
          values: [
            { value: 'Xám', colorHex: '#999999' },
            { value: 'Nâu', colorHex: '#7A4A2A' },
          ],
        },
      ],
    },
  },
}));

const variant = (id: number, color: string) => ({
  id,
  sku: `SOFA-${id}`,
  color: { name: color, hex: '#999999' },
  size: '2m',
  price: 5_000_000,
  salePrice: 4_500_000,
  stockQuantity: 3,
  isActive: true,
});
const PRODUCT = {
  id: 7,
  name: 'Sofa thử',
  slug: 'sofa-thu',
  sku: 'SOFA-11',
  categoryId: 3,
  status: 'published',
  isFeatured: true,
  brand: 'Hãng',
  price: 5_000_000,
  salePrice: 4_500_000,
  stockQuantity: 6,
  shortDescription: 'Mô tả ngắn',
  description: 'Mô tả',
  material: 'Gỗ',
  style: '',
  features: [],
  metaTitle: 'SEO',
  metaDescription: 'SEO mô tả',
  model: null,
  images: [],
  variants: [variant(11, 'Xám'), variant(12, 'Xám')],
};

type SentVariant = { id?: number; color?: { name: string; hex?: string } | null };
type Sent = Record<string, unknown> & { variants?: SentVariant[] };

async function open(product: object = PRODUCT) {
  mocks.get.mockResolvedValue(product);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProductForm productId={7} />
    </QueryClientProvider>,
  );
  await screen.findByDisplayValue('Sofa thử');
}
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

async function save(): Promise<Sent> {
  fireEvent.click(screen.getByRole('button', { name: 'Lưu sản phẩm' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
  // đúng những gì đi qua mạng: khóa có giá trị undefined bị bỏ khỏi JSON
  return JSON.parse(JSON.stringify(mocks.update.mock.calls[0][1])) as Sent;
}

describe('ProductForm: không làm mất giá trị admin không sửa', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.update.mockReset().mockResolvedValue(PRODUCT);
  });

  it('có ô "Sản phẩm nổi bật" hiện đúng giá trị đã lưu; lưu không sửa ⇒ gửi isFeatured = true', async () => {
    await open();
    expect(screen.getByRole('checkbox', { name: /Sản phẩm nổi bật/ })).toBeChecked();
    expect((await save()).isFeatured).toBe(true);
  });

  it('bỏ chọn "Sản phẩm nổi bật" ⇒ gửi isFeatured = false', async () => {
    await open();
    fireEvent.click(screen.getByRole('checkbox', { name: /Sản phẩm nổi bật/ }));
    expect((await save()).isFeatured).toBe(false);
  });

  it('không đổi chất liệu ⇒ không gửi material (để mỗi biến thể giữ chất liệu của mình)', async () => {
    await open();
    expect(await save()).not.toHaveProperty('material');
  });

  it('đổi chất liệu ⇒ gửi chất liệu mới', async () => {
    await open();
    tab('Thuộc tính');
    fireEvent.change(screen.getByLabelText('Chất liệu'), { target: { value: 'Da' } });
    expect((await save()).material).toBe('Da');
  });

  it('không đổi màu ⇒ gửi tên màu, không gửi kèm mã hex (mã màu dùng chung, sửa ở trang Thuộc tính)', async () => {
    await open();
    expect((await save()).variants!.map((v) => v.color)).toEqual([{ name: 'Xám' }, { name: 'Xám' }]);
  });

  it('đổi màu một biến thể ⇒ gửi kèm mã hex của màu mới', async () => {
    await open();
    tab('Biến thể');
    await screen.findAllByRole('option', { name: 'Nâu' });
    fireEvent.change(screen.getAllByLabelText('Màu')[1], { target: { value: 'Nâu' } });
    expect((await save()).variants!.map((v) => v.color)).toEqual([
      { name: 'Xám' },
      { name: 'Nâu', hex: '#7A4A2A' },
    ]);
  });

  it('xóa hết dòng biến thể ⇒ gửi variants = [] (yêu cầu gộp rõ ràng, khác với không gửi)', async () => {
    await open();
    tab('Biến thể');
    for (const b of screen.getAllByRole('button', { name: 'Xóa biến thể' }).reverse()) fireEvent.click(b);
    expect((await save()).variants).toEqual([]);
  });
});

describe('mock API: cập nhật sản phẩm giữ trường không gửi lên', () => {
  type Variant = {
    id: number;
    sku: string;
    price: number;
    salePrice: number | null;
    stockQuantity: number;
    color: { name: string; hex: string } | null;
    size: string | null;
    material: string | null;
    isActive: boolean;
  };
  type P = {
    id: number;
    name: string;
    categoryId: number;
    status: string;
    isFeatured: boolean;
    brand: string | null;
    shortDescription: string;
    description: string;
    metaTitle: string | null;
    metaDescription: string | null;
    variants: Variant[];
  };

  async function api() {
    const { handleMockRequest } = await import('@/mock-data/mockApi');
    localStorage.setItem('aurelia-mock-config', JSON.stringify({ latency: false }));
    let token: string | null = null;
    const call = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      const r = await handleMockRequest({ method, path, query: {}, body, token });
      if (r.status >= 400) throw new Error(`${r.status} ${JSON.stringify(r.body)}`);
      return (r.body as unknown as { data: T }).data;
    };
    const login = await call<{ tokens: { accessToken: string } }>('POST', '/auth/login', {
      email: 'admin@aurelia.vn',
      password: 'admin123',
    });
    token = login.tokens.accessToken;
    let n = 0;
    const create = async (count: number) => {
      const key = `${Date.now()}-${++n}-${count}`;
      return call<P>('POST', '/admin/products', {
        name: `Mock giữ trường ${key}`,
        sku: `MK-${key}`,
        categoryId: 3,
        status: 'draft',
        isFeatured: true,
        brand: 'Hãng Giữ',
        price: 1_800_000,
        stock: 5,
        shortDescription: 'Mô tả ngắn',
        description: 'Mô tả cần giữ',
        metaTitle: 'SEO cần giữ',
        metaDescription: 'Mô tả SEO cần giữ',
        material: 'Gỗ',
        variants: Array.from({ length: count }, (_, i) => ({
          sku: `MK-${key}-${i}`,
          color: { name: i ? 'Đen' : 'Kem', hex: i ? '#2B2B2B' : '#E8DCC8' },
          size: `1m${6 + i}`,
          price: 2_000_000,
          salePrice: 1_800_000,
          stockQuantity: 5,
        })),
      });
    };
    const min = (p: P) => ({ name: p.name, categoryId: p.categoryId, shortDescription: 'Mô tả ngắn' });
    return { call, create, min };
  }

  it('trường của sản phẩm và biến thể không gửi lên ⇒ giữ nguyên', async () => {
    const { call, create, min } = await api();
    const p = await create(2);
    const after = await call<P>('PATCH', `/admin/products/${p.id}`, {
      ...min(p),
      price: 2_000_000,
      stock: 5,
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        stockQuantity: v.stockQuantity,
      })),
    });
    const kept = (x: P) => ({
      status: x.status,
      isFeatured: x.isFeatured,
      brand: x.brand,
      description: x.description,
      metaTitle: x.metaTitle,
      metaDescription: x.metaDescription,
      variants: x.variants.map((v) => [v.salePrice, v.color?.name, v.size, v.material]),
    });
    expect(kept(after)).toEqual(kept(p));
  });

  it('không gửi mảng variants: nhiều biến thể giữ nguyên; một biến thể nhận price/stock, giữ thuộc tính', async () => {
    const { call, create, min } = await api();
    const view = (v: Variant) => [v.id, v.isActive, v.price, v.salePrice, v.stockQuantity, v.color?.name];
    const many = await create(2);
    const same = await call<P>('PATCH', `/admin/products/${many.id}`, min(many));
    expect(same.variants.map(view)).toEqual(many.variants.map(view));

    const one = await create(1);
    const next = await call<P>('PATCH', `/admin/products/${one.id}`, { ...min(one), stock: 42 });
    expect(next.variants.map(view)).toEqual([[one.variants[0].id, true, 2_000_000, 1_800_000, 42, 'Kem']]);
  });
});
