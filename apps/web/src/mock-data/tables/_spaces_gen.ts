// Sinh các bảng không gian mẫu: spaces, space_panoramas, space_hotspots, space_product_placements, space_bookmarks, space_views
import type {
  RoomType,
  Space,
  SpaceBookmark,
  SpaceHotspot,
  SpacePanorama,
  SpaceProductPlacement,
  SpaceView,
} from '@aurelia-living/shared-types';
import { slugify } from '@/lib/format';
import { panoImg, roomImg } from '../utils/img';
import { registerMedia } from '../utils/media-registry';
import { addDays, iso, makeRng } from '../utils/rng';
import { categories } from './categories';
import { product3dModels, productExtras, products } from './_products_gen';
import { TEST_CUSTOMER_ID, users } from './users';

const rng = makeRng(404);

const STYLES = ['Hiện đại', 'Bắc Âu', 'Tối giản', 'Japandi', 'Cổ điển', 'Luxury'] as const;
const ROOMS: Array<{ room: RoomType; label: string; cats: string[] }> = [
  {
    room: 'living_room',
    label: 'Phòng khách',
    cats: ['sofa', 'ban-tra', 'ke-tivi', 'ghe-thu-gian', 'den-trang-tri-ban', 'tham'],
  },
  {
    room: 'bedroom',
    label: 'Phòng ngủ',
    cats: ['giuong', 'tu-quan-ao', 'tu-dau-giuong', 'den-trang-tri-ban', 'guong', 'tham'],
  },
  {
    room: 'dining_room',
    label: 'Phòng ăn',
    cats: ['ban-an', 'ghe-an', 'tu-ruou', 'den-trang-tri-ban', 'tham'],
  },
  {
    room: 'office',
    label: 'Phòng làm việc',
    cats: ['ban-lam-viec', 'ghe-van-phong', 'ke-sach', 'den-trang-tri-ban', 'tham'],
  },
];
const adjective: Record<(typeof STYLES)[number], string> = {
  'Hiện đại': 'hiện đại',
  'Bắc Âu': 'phong cách Bắc Âu',
  'Tối giản': 'tối giản',
  Japandi: 'phong cách Japandi',
  'Cổ điển': 'cổ điển',
  Luxury: 'sang trọng Luxury',
};

export const spaces: Space[] = [];
export const spacePanoramas: SpacePanorama[] = [];
export const spaceHotspots: SpaceHotspot[] = [];
export const spaceProductPlacements: SpaceProductPlacement[] = [];
export const spaceBookmarks: SpaceBookmark[] = [];
export const spaceViews: SpaceView[] = [];

const catIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
const styleOf = (productId: number) => productExtras.find((e) => e.productId === productId)?.style;
const slots = [-135, -45, 45, 135, 0];

let n = 0;
for (const style of STYLES) {
  for (const r of ROOMS) {
    n++;
    const id = n;
    const title = `${r.label} ${adjective[style]}`;
    const at = iso(addDays(new Date('2026-02-01T08:00:00.000Z'), n * 9));
    const status = id === 11 || id === 20 ? 'draft' : id === 23 ? 'archived' : 'published';

    // chọn mỗi danh mục 1 sản phẩm (ưu tiên đúng phong cách và có mô hình 3D)
    const chosen: number[] = [];
    for (const slug of r.cats) {
      const catId = catIdBySlug.get(slug)!;
      const pool = products.filter((p) => p.categoryId === catId && p.status === 'published');
      if (!pool.length) continue;
      const preferred = pool.filter((p) => styleOf(p.id) === style);
      const withModel = (preferred.length ? preferred : pool).filter((p) =>
        product3dModels.some((m) => m.productId === p.id && m.status === 'ready'),
      );
      chosen.push(rng.pick(withModel.length ? withModel : preferred.length ? preferred : pool).id);
    }
    const uniq = [...new Set(chosen)].slice(0, 5);

    const coverMediaId = registerMedia(
      roomImg(style, r.room, id),
      `space-${slugify(title)}-cover.svg`,
      'image/svg+xml',
      9000,
      title,
    );
    spaces.push({
      id,
      uuid: `20000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      title,
      slug: slugify(title),
      description: `${title}: bộ sưu tập ${uniq.length} sản phẩm được phối sẵn, hài hòa về màu sắc và chất liệu. Bấm vào các điểm tương tác trong ảnh 360° để xem chi tiết từng món đồ và thêm cả bộ vào giỏ hàng với giá combo ưu đãi.`,
      roomType: r.room,
      style,
      categoryId: catIdBySlug.get('phong-khach') ?? null,
      coverMediaId,
      status,
      viewCount: rng.int(120, 4200),
      publishedAt: status === 'published' ? at : null,
      createdAt: at,
      updatedAt: at,
    });

    // 2 ảnh 360°: ảnh đầu tiên (start) + ảnh thứ hai (góc khác)
    const pIds: number[] = [];
    for (let k = 0; k < 2; k++) {
      const pid = spacePanoramas.length + 1;
      pIds.push(pid);
      spacePanoramas.push({
        id: pid,
        spaceId: id,
        mediaId: registerMedia(
          panoImg(style, r.room, id * 2 + k),
          `space-${id}-pano-${k + 1}.svg`,
          'image/svg+xml',
          120_000,
          `${title} – góc ${k + 1}`,
        ),
        title: k === 0 ? 'Góc chính' : 'Góc phụ',
        defaultYaw: k === 0 ? -135 : 45,
        defaultPitch: 0,
        defaultFov: 80,
        sortOrder: k + 1,
        isStart: k === 0,
        createdAt: at,
        updatedAt: at,
      });
    }

    // hotspot sản phẩm + placement trên ảnh đầu tiên
    uniq.forEach((productId, i) => {
      const yaw = slots[i % slots.length] + rng.int(-8, 8);
      const pitch = rng.int(-14, -4);
      spaceHotspots.push({
        id: spaceHotspots.length + 1,
        panoramaId: pIds[0],
        type: 'product',
        yaw,
        pitch,
        productId,
        targetPanoramaId: null,
        title: null,
        content: null,
        createdAt: at,
        updatedAt: at,
      });
      const model = product3dModels.find((m) => m.productId === productId);
      if (model && i < 4) {
        spaceProductPlacements.push({
          id: spaceProductPlacements.length + 1,
          panoramaId: pIds[0],
          productId,
          variantId: null,
          modelId: model.id,
          yaw,
          pitch,
          distance: 2.2 + rng.next(),
          rotationX: 0,
          rotationY: rng.int(0, 90),
          rotationZ: 0,
          scale: 1,
          createdAt: at,
          updatedAt: at,
        });
      }
    });
    spaceHotspots.push({
      id: spaceHotspots.length + 1,
      panoramaId: pIds[0],
      type: 'navigation',
      yaw: 90,
      pitch: 0,
      productId: null,
      targetPanoramaId: pIds[1],
      title: 'Sang góc phụ',
      content: null,
      createdAt: at,
      updatedAt: at,
    });
    spaceHotspots.push({
      id: spaceHotspots.length + 1,
      panoramaId: pIds[0],
      type: 'info',
      yaw: -90,
      pitch: 10,
      productId: null,
      targetPanoramaId: null,
      title: 'Chất liệu tường',
      content: 'Sơn chống ẩm tông kem, dễ lau chùi.',
      createdAt: at,
      updatedAt: at,
    });
    spaceHotspots.push({
      id: spaceHotspots.length + 1,
      panoramaId: pIds[1],
      type: 'navigation',
      yaw: -90,
      pitch: 0,
      productId: null,
      targetPanoramaId: pIds[0],
      title: 'Về góc chính',
      content: null,
      createdAt: at,
      updatedAt: at,
    });
  }
}

// Khách test lưu 3 không gian yêu thích
[1, 6, 9].forEach((spaceId, i) =>
  spaceBookmarks.push({
    id: i + 1,
    userId: TEST_CUSTOMER_ID,
    spaceId,
    createdAt: '2026-09-12T10:00:00.000Z',
  }),
);
// Lượt xem không gian
for (let i = 0; i < 60; i++) {
  const sp = rng.pick(spaces.filter((s) => s.status === 'published'));
  const byUser = rng.chance(0.5);
  spaceViews.push({
    id: i + 1,
    spaceId: sp.id,
    userId: byUser ? rng.pick(users.filter((u) => u.id > 1)).id : null,
    visitorId: byUser ? null : `v-${rng.int(1000, 9999)}`,
    sourceProductId: rng.chance(0.3) ? rng.int(1, products.length) : null,
    hotspotClickCount: rng.int(0, 6),
    addedToCart: rng.chance(0.2),
    createdAt: iso(addDays(new Date('2026-03-01T08:00:00.000Z'), rng.int(0, 230))),
  });
}
