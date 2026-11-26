import { CatalogViews, type ProductRow } from './catalog-views.service';

const views = new CatalogViews({} as never, {} as never);

const variant = (id: number, color: string, isActive = true) => ({
  id,
  isActive,
  variantAttributeValues: [{ attributeCode: 'color', attributeValue: { value: color, colorHex: null } }],
});
// 2 màu × 2 cỡ: id 1,2 = Be; id 3,4 = Xanh
const variants = [variant(1, 'Be'), variant(2, 'Be'), variant(3, 'Xanh'), variant(4, 'Xanh')];
const row = (images: Array<{ isPrimary: boolean; variantId: number | null }>, vs = variants) =>
  ({ productVariants: vs, productImages: images }) as unknown as ProductRow;

describe('CatalogViews.defaultVariant', () => {
  it('ảnh chính không gắn biến thể → màu của biến thể đầu tiên, phần tử thứ 2 của nhóm', () => {
    expect(views.defaultVariant(row([{ isPrimary: true, variantId: null }]))?.id).toBe(2);
    expect(views.defaultVariant(row([]))?.id).toBe(2);
  });
  it('ảnh chính gắn một màu → mặc định là màu đó (cùng quy tắc chọn cỡ)', () => {
    const images = [
      { isPrimary: false, variantId: 1 },
      { isPrimary: true, variantId: 3 },
    ];
    expect(views.defaultVariant(row(images))?.id).toBe(4);
  });
  it('biến thể gắn với ảnh chính đã tắt → quay về màu đầu tiên', () => {
    const vs = [variant(1, 'Be'), variant(2, 'Be'), variant(3, 'Xanh', false)];
    expect(views.defaultVariant(row([{ isPrimary: true, variantId: 3 }], vs))?.id).toBe(2);
  });
});
