// Bảng `categories` – cây 2 cấp (5 nhóm phòng → 17 danh mục lá)
import type { Category } from '@aurelia-living/shared-types';
import { productImg, roomImg } from '../utils/img';
import { registerMedia } from '../utils/media-registry';
import type { FurnitureType } from '../utils/svg';

interface Spec {
  name: string;
  slug: string;
  children: Array<{
    name: string;
    slug: string;
    type: FurnitureType;
    color: string;
    featured?: boolean;
    description: string;
  }>;
  room: string;
}

const tree: Spec[] = [
  {
    name: 'Phòng khách',
    slug: 'phong-khach',
    room: 'living_room',
    children: [
      {
        name: 'Sofa',
        slug: 'sofa',
        type: 'sofa',
        color: 'C9B8A0',
        featured: true,
        description: 'Khám phá các mẫu sofa tại Aurelia Living',
      },
      {
        name: 'Bàn trà',
        slug: 'ban-tra',
        type: 'coffee_table',
        color: 'C9A26B',
        description: 'Bàn trà đa dạng chất liệu cho phòng khách',
      },
      {
        name: 'Kệ tivi',
        slug: 'ke-tivi',
        type: 'tv_stand',
        color: '5C4033',
        description: 'Kệ tivi hiện đại, tối ưu không gian',
      },
      {
        name: 'Ghế thư giãn',
        slug: 'ghe-thu-gian',
        type: 'armchair',
        color: 'D8C3A5',
        featured: true,
        description: 'Ghế bành, ghế đọc sách êm ái',
      },
    ],
  },
  {
    name: 'Phòng ngủ',
    slug: 'phong-ngu',
    room: 'bedroom',
    children: [
      {
        name: 'Giường',
        slug: 'giuong',
        type: 'bed',
        color: 'E8DCC8',
        featured: true,
        description: 'Giường ngủ chắc chắn, thiết kế tinh tế',
      },
      {
        name: 'Tủ quần áo',
        slug: 'tu-quan-ao',
        type: 'wardrobe',
        color: 'F5F5F0',
        featured: true,
        description: 'Tủ quần áo dung tích lớn',
      },
      {
        name: 'Tủ đầu giường',
        slug: 'tu-dau-giuong',
        type: 'nightstand',
        color: 'C9A26B',
        description: 'Tủ đầu giường nhỏ gọn',
      },
    ],
  },
  {
    name: 'Phòng ăn',
    slug: 'phong-an',
    room: 'dining_room',
    children: [
      {
        name: 'Bàn ăn',
        slug: 'ban-an',
        type: 'dining_table',
        color: 'C9A26B',
        featured: true,
        description: 'Bàn ăn gỗ tự nhiên, đá nhân tạo',
      },
      {
        name: 'Ghế ăn',
        slug: 'ghe-an',
        type: 'dining_chair',
        color: '7B5239',
        description: 'Ghế ăn êm ái, dễ phối',
      },
      {
        name: 'Tủ rượu',
        slug: 'tu-ruou',
        type: 'cabinet',
        color: '5C4033',
        description: 'Tủ rượu, tủ trưng bày',
      },
    ],
  },
  {
    name: 'Phòng làm việc',
    slug: 'phong-lam-viec',
    room: 'office',
    children: [
      {
        name: 'Bàn làm việc',
        slug: 'ban-lam-viec',
        type: 'desk',
        color: 'C9A26B',
        description: 'Bàn làm việc tại nhà gọn gàng',
      },
      {
        name: 'Ghế văn phòng',
        slug: 'ghe-van-phong',
        type: 'office_chair',
        color: '2B2B2B',
        description: 'Ghế công thái học bảo vệ cột sống',
      },
      {
        name: 'Kệ sách',
        slug: 'ke-sach',
        type: 'bookshelf',
        color: '8E8E8E',
        description: 'Kệ sách, kệ trang trí',
      },
    ],
  },
  {
    name: 'Đèn & trang trí',
    slug: 'den-trang-tri',
    room: 'living_room',
    children: [
      {
        name: 'Đèn trang trí',
        slug: 'den-trang-tri-ban',
        type: 'lamp',
        color: 'E8DCC8',
        featured: true,
        description: 'Đèn bàn, đèn cây, đèn thả trần',
      },
      { name: 'Thảm', slug: 'tham', type: 'rug', color: 'D8C3A5', description: 'Thảm trải sàn mềm mại' },
      {
        name: 'Gương',
        slug: 'guong',
        type: 'mirror',
        color: '5C4033',
        description: 'Gương trang trí, gương toàn thân',
      },
    ],
  },
];

export const categories: Category[] = [];
/** Phần mở rộng chưa có cột trong DB: mô tả, loại đồ minh họa, cờ nổi bật */
export const categoryExtras: Record<
  number,
  { description: string; isFeatured: boolean; type: FurnitureType | null }
> = {};

let id = 0;
const created = '2026-01-02T08:00:00.000Z';
tree.forEach((p, pi) => {
  const pid = ++id;
  categories.push({
    id: pid,
    parentId: null,
    name: p.name,
    slug: p.slug,
    imageMediaId: registerMedia(
      roomImg('Hiện đại', p.room, pi + 1),
      `category-${p.slug}.svg`,
      'image/svg+xml',
      6000,
      p.name,
    ),
    sortOrder: pi + 1,
    isActive: true,
    metaTitle: `${p.name} – Aurelia Living`,
    metaDescription: `Nội thất ${p.name.toLowerCase()} hiện đại, xem 3D/AR trước khi mua.`,
    createdAt: created,
    updatedAt: created,
  });
  categoryExtras[pid] = {
    description: `Bộ sưu tập ${p.name.toLowerCase()} của Aurelia Living`,
    isFeatured: false,
    type: null,
  };
  p.children.forEach((c, ci) => {
    const cid = ++id;
    categories.push({
      id: cid,
      parentId: pid,
      name: c.name,
      slug: c.slug,
      imageMediaId: registerMedia(
        productImg(c.type, c.color, 1),
        `category-${c.slug}.svg`,
        'image/svg+xml',
        5000,
        c.name,
      ),
      sortOrder: ci + 1,
      isActive: true,
      metaTitle: `${c.name} – Aurelia Living`,
      metaDescription: c.description,
      createdAt: created,
      updatedAt: created,
    });
    categoryExtras[cid] = { description: c.description, isFeatured: Boolean(c.featured), type: c.type };
  });
});
