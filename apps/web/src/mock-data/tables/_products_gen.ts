// Sinh các bảng liên quan sản phẩm từ _products_spec.ts: products, product_variants, variant_attribute_values,
// product_images, product_3d_models, model_files (+ product_extras cho trường chưa có trong DB).
import type {
  ModelFile,
  Product,
  Product3DModel,
  ProductImage,
  ProductVariant,
  VariantAttributeValue,
} from '@aurelia-living/shared-types';
import { slugify } from '@/lib/format';
import { productImg } from '../utils/img';
import { mediaRows, registerMedia } from '../utils/media-registry';
import { addDays, iso, makeRng, roundPrice } from '../utils/rng';
import { COLORS, valueId } from './attributes';
import { categories } from './categories';
import { productSpecs, sizeSets, type ProductSpec } from './_products_spec';

const rng = makeRng(303);

export interface ProductExtra {
  productId: number;
  style: string; // TODO: chưa có trong DB
  costPrice: number; // TODO: chưa có trong DB (giá vốn của biến thể chuẩn)
  dims: [number, number, number]; // D×R×C (mm) của kích thước chuẩn – TODO: chưa có trong DB
  sizeDimMult: Record<string, number>; // nhãn kích thước → hệ số kích thước – TODO: chưa có trong DB
  costRatio: number; // TODO: chưa có trong DB (giá vốn / giá bán, dùng cho mọi biến thể)
  minStock: number; // TODO: chưa có trong DB
  features: string[]; // TODO: chưa có trong DB
  specs: Array<{ label: string; value: string }>; // TODO: chưa có trong DB
  type: ProductSpec['type'];
  modelKey: ProductSpec['model'];
}

export const products: Product[] = [];
export const productVariants: ProductVariant[] = [];
export const variantAttributeValues: VariantAttributeValue[] = [];
export const productImages: ProductImage[] = [];
export const product3dModels: Product3DModel[] = [];
export const modelFiles: ModelFile[] = [];
export const productExtras: ProductExtra[] = [];

const leafBySlug = new Map(categories.map((c) => [c.slug, c]));
const colorOf = (name: string) => COLORS.find((c) => c.name === name)!;

const featurePool: Record<string, string[]> = {
  Vải: [
    'Vải bọc cao cấp, thoáng khí, chống bám bụi',
    'Có thể tháo vỏ đệm để giặt',
    'Mút D40 đàn hồi tốt, không xẹp lún',
  ],
  Da: ['Da thật nhập khẩu, mềm mại, bền màu', 'Đường may thủ công tỉ mỉ', 'Chống thấm nước, dễ lau chùi'],
  Nỉ: [
    'Nỉ nhung mịn, ấm áp, không xù lông',
    'Màu sắc sâu và bền theo thời gian',
    'Khung gỗ sồi tẩm sấy chống mối mọt',
  ],
  Gỗ: [
    'Gỗ tự nhiên tẩm sấy, chống cong vênh',
    'Bề mặt phủ PU chống nước, chống xước',
    'Mối ghép mộng chắc chắn, không dùng đinh lộ',
  ],
  'Kim loại': [
    'Khung thép sơn tĩnh điện chống gỉ',
    'Chân có nút cao su bảo vệ sàn',
    'Dễ lắp ráp, có hướng dẫn chi tiết',
  ],
  Đá: ['Mặt đá nhân tạo chống trầy, chịu nhiệt', 'Chân thép mạ chắc chắn', 'Dễ vệ sinh bằng khăn ẩm'],
  Kính: ['Kính cường lực 8mm an toàn', 'Viền khung hoàn thiện sắc nét', 'Bản lề giảm chấn êm ái'],
};
const commonFeatures = [
  'Có mô hình 3D, xem trước kích thước trong không gian của bạn',
  'Giao hàng toàn quốc, hỗ trợ lắp đặt tại nhà',
  'Đổi trả trong 7 ngày nếu có lỗi từ nhà sản xuất',
];

let imgSeq = 0;
const addProductImage = (
  productId: number,
  variantId: number | null,
  mediaId: number,
  sortOrder: number,
  isPrimary: boolean,
  at: string,
) => {
  productImages.push({
    id: ++imgSeq,
    productId,
    variantId,
    mediaId,
    sortOrder,
    isPrimary,
    createdAt: at,
    updatedAt: at,
  });
};

productSpecs.forEach((s, idx) => {
  const id = idx + 1;
  const slug = slugify(s.name);
  const cat = leafBySlug.get(s.cat)!;
  const createdAt = iso(addDays(new Date('2026-01-08T08:00:00.000Z'), Math.round(idx * 5.6)));
  const colors = s.colors.map(colorOf);
  const sizes = sizeSets[s.sizeSet];

  const desc = [
    `${s.name} mang phong cách ${s.style.toLowerCase()} với chất liệu ${s.material.toLowerCase()} được chọn lọc kỹ lưỡng, phù hợp cho cả căn hộ chung cư lẫn nhà phố. Đường nét thiết kế mềm mại giúp sản phẩm dễ dàng hòa hợp với nhiều không gian sống.`,
    `Mỗi sản phẩm được hoàn thiện thủ công bởi đội ngũ thợ lành nghề, trải qua 5 bước kiểm tra chất lượng trước khi đến tay bạn. Bạn có thể xem mô hình 3D và đặt thử sản phẩm vào căn phòng của mình bằng AR để chắc chắn về kích thước và màu sắc.`,
    `Bảo hành chính hãng ${s.warrantyMonths ?? 12} tháng, hỗ trợ giao hàng và lắp đặt tận nơi.`,
  ].join('\n\n');

  products.push({
    id,
    name: s.name,
    slug,
    shortDescription: `${s.name} – ${s.material.toLowerCase()} phong cách ${s.style.toLowerCase()}, thiết kế tinh tế, bền đẹp theo thời gian.`,
    description: desc,
    categoryId: cat.id,
    brandId: s.brand,
    status: 'published',
    isFeatured: Boolean(s.featured),
    ratingAvg: 0, // tính lại từ reviews khi khởi tạo db
    ratingCount: 0,
    soldCount: 0, // tính lại từ order_items khi khởi tạo db
    has3dModel: false,
    hasAr: false,
    metaTitle: `${s.name} | Aurelia Living`,
    metaDescription: `Mua ${s.name.toLowerCase()} chính hãng, xem 3D/AR trước khi đặt hàng.`,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  });

  // ----- Biến thể: màu × kích thước -----
  const firstVariantByColor = new Map<string, number>();
  let defaultVariantIdx = 0;
  colors.forEach((col, ci) => {
    sizes.forEach((sz, si) => {
      const vid = productVariants.length + 1;
      const price = roundPrice(s.price * sz.mult);
      const salePrice = s.sale ? roundPrice(s.sale * sz.mult) : null;
      let stock = rng.int(6, 42);
      if (s.stock === 'out') stock = 0;
      else if (s.stock === 'low') stock = rng.int(1, 3);
      else if (rng.chance(0.06)) stock = 0;
      // Tổ hợp hết hàng cố định để thử trạng thái disabled ở trang 360°
      if (
        (s.name === 'Sofa Nordic' && col.name === 'Xám' && sz.label === '4 chỗ') ||
        (s.name === 'Giường bọc nỉ' && col.name === 'Xanh' && sz.label === '2m') ||
        (s.name === 'Bàn ăn gỗ tự nhiên' && col.name === 'Trắng')
      )
        stock = 0;
      productVariants.push({
        id: vid,
        productId: id,
        sku: `${s.cat
          .split('-')
          .map((w) => w[0])
          .join('')
          .toUpperCase()}${String(id).padStart(2, '0')}-${slugify(col.name).slice(0, 3).toUpperCase()}${si + 1}`,
        price,
        salePrice,
        stockQuantity: stock,
        weightGram: Math.round(((s.dims[0] * s.dims[1] * s.dims[2]) / 1e9) * 180_000 * sz.dimMult) + 2000,
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      });
      const link = (attributeId: number, value: string) =>
        variantAttributeValues.push({
          variantId: vid,
          attributeValueId: valueId(attributeId, value),
          attributeId,
          createdAt,
        });
      link(1, col.name);
      link(2, s.sizeSet === 'desk' && sz.label === '1m6' ? '1m6 (bàn)' : sz.label);
      link(3, s.material);
      if (!firstVariantByColor.has(col.name)) firstVariantByColor.set(col.name, vid);
      if (ci === 0 && sizes.length > 1 && si === 1) defaultVariantIdx = vid;
      if (ci === 0 && sizes.length === 1) defaultVariantIdx = vid;
    });
  });

  // ----- Ảnh: 4–5 ảnh chung + 1 ảnh riêng mỗi màu phụ -----
  const base = colors[0];
  const views = idx % 2 === 0 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
  views.forEach((v, i) => {
    const mid = registerMedia(
      productImg(s.type, base.hex, v),
      `${slug}-${v}.svg`,
      'image/svg+xml',
      7000 + v * 300,
      `${s.name} – góc ${v}`,
    );
    addProductImage(id, null, mid, i + 1, i === 0, createdAt);
  });
  colors.slice(1).forEach((col, i) => {
    const vid = firstVariantByColor.get(col.name)!;
    const mid = registerMedia(
      productImg(s.type, col.hex, 1),
      `${slug}-${slugify(col.name)}.svg`,
      'image/svg+xml',
      7200,
      `${s.name} màu ${col.name}`,
    );
    addProductImage(id, vid, mid, views.length + i + 1, false, createdAt);
  });

  // ----- Phần mở rộng -----
  const [l, w, h] = s.dims;
  const costRatio = rng.pick([0.58, 0.6, 0.62, 0.65]);
  productExtras.push({
    productId: id,
    style: s.style,
    costPrice: roundPrice((s.sale ?? s.price) * costRatio),
    costRatio,
    dims: s.dims,
    sizeDimMult: Object.fromEntries(
      sizes.map((z) => [z.label === '1m6' && s.sizeSet === 'desk' ? '1m6 (bàn)' : z.label, z.dimMult]),
    ),
    minStock: 5,
    features: [...(featurePool[s.material] ?? featurePool['Gỗ']), ...commonFeatures].slice(0, 5),
    specs: [
      { label: 'Kích thước (D × R × C)', value: `${l} × ${w} × ${h} mm` },
      { label: 'Chất liệu', value: s.material },
      { label: 'Màu sắc', value: s.colors.join(', ') },
      { label: 'Phong cách', value: s.style },
      {
        label: 'Thương hiệu',
        value: [
          '',
          'Aurelia Home',
          'Nordic Living',
          'Oak & Co',
          'Maison Luxe',
          'Japandi Studio',
          'Urban Nest',
        ][s.brand],
      },
      { label: 'Xuất xứ', value: 'Việt Nam' },
      { label: 'Bảo hành', value: `${s.warrantyMonths ?? 12} tháng` },
    ],
    type: s.type,
    modelKey: s.model,
  });
  void defaultVariantIdx;

  // ----- Mô hình 3D: ~2/3 sản phẩm có model -----
  if (s.model && idx % 3 !== 2) {
    const mid = product3dModels.length + 1;
    const placement = ['mirror', 'bookshelf'].includes(s.type)
      ? 'wall'
      : ['coffee_table', 'lamp', 'nightstand'].includes(s.type)
        ? 'table'
        : 'floor';
    const status = mid === 7 ? 'processing' : mid === 13 ? 'failed' : 'ready';
    const posterMediaId = productImages.find((p) => p.productId === id && p.isPrimary)!.mediaId;
    product3dModels.push({
      id: mid,
      uuid: `10000000-0000-4000-8000-${String(mid).padStart(12, '0')}`,
      productId: id,
      variantId: null,
      lengthMm: l,
      widthMm: w,
      heightMm: h,
      placement,
      allowScaling: false,
      viewerConfig: { autoRotate: true, exposure: 1, shadowIntensity: 1, cameraOrbit: '45deg 70deg auto' },
      posterMediaId,
      status,
      version: 1,
      isPrimary: true,
      createdAt: iso(addDays(new Date(createdAt), 2)),
      updatedAt: iso(addDays(new Date(createdAt), 2)),
    });
    const sizeBytes = Math.round((2.2 + rng.next() * 15) * 1024 * 1024);
    const glbMedia = registerMedia(
      `/mock/models/${s.model}.glb?p=${id}`,
      `${slug.replace(/-/g, '_')}.glb`,
      'model/gltf-binary',
      sizeBytes,
      `Mô hình 3D ${s.name}`,
    );
    modelFiles.push({
      id: modelFiles.length + 1,
      modelId: mid,
      format: 'glb',
      lod: 'high',
      mediaId: glbMedia,
      polygonCount: rng.int(18, 90) * 1000,
      textureResolution: 2048,
      isCompressed: true,
      checksum: `sha256-${(id * 7919).toString(16).padStart(8, '0')}${(mid * 104729).toString(16).padStart(8, '0')}`,
      createdAt,
      updatedAt: createdAt,
    });
    if (mid % 3 === 1) {
      const usdzMedia = registerMedia(
        `/mock/models/placeholder.usdz?p=${id}`,
        `${slug.replace(/-/g, '_')}.usdz`,
        'model/vnd.usdz+zip',
        Math.round(sizeBytes * 0.8),
        `Mô hình USDZ ${s.name}`,
      );
      modelFiles.push({
        id: modelFiles.length + 1,
        modelId: mid,
        format: 'usdz',
        lod: 'high',
        mediaId: usdzMedia,
        polygonCount: null,
        textureResolution: 2048,
        isCompressed: false,
        checksum: `sha256-u${(id * 6151).toString(16).padStart(8, '0')}`,
        createdAt,
        updatedAt: createdAt,
      });
    }
    if (status === 'ready') {
      const p = products[products.length - 1];
      p.has3dModel = true;
      p.hasAr = !['rug', 'mirror'].includes(s.type);
    }
  }
});

void mediaRows;
