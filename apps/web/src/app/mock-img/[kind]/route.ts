// Ảnh SVG minh họa cho dữ liệu giả: /mock-img/product?t=sofa&c=C9B6A0&v=1 … (chỉ dùng khi chạy với mock-data)
import {
  avatarSvg,
  bannerSvg,
  panoSvg,
  productSvg,
  roomSvg,
  type FurnitureType,
} from '@/mock-data/utils/svg';

const TYPES: FurnitureType[] = [
  'sofa',
  'armchair',
  'coffee_table',
  'tv_stand',
  'bed',
  'wardrobe',
  'nightstand',
  'dining_table',
  'dining_chair',
  'cabinet',
  'desk',
  'office_chair',
  'bookshelf',
  'lamp',
  'rug',
  'mirror',
  'beanbag',
];

export function GET(req: Request, { params }: { params: { kind: string } }) {
  const sp = new URL(req.url).searchParams;
  const kind = params.kind.replace(/\.svg$/, '');
  const num = (k: string, d: number) => {
    const n = Number(sp.get(k));
    return Number.isFinite(n) && sp.get(k) !== null ? n : d;
  };
  let svg: string;
  switch (kind) {
    case 'product': {
      const t = (sp.get('t') ?? 'sofa') as FurnitureType;
      svg = productSvg(
        TYPES.includes(t) ? t : 'sofa',
        sp.get('c') ?? 'C9B6A0',
        num('v', 1),
        sp.get('l') ?? undefined,
      );
      break;
    }
    case 'room':
      svg = roomSvg(sp.get('s') ?? 'Hiện đại', sp.get('r') ?? 'living_room', num('n', 1));
      break;
    case 'pano':
      svg = panoSvg(sp.get('s') ?? 'Hiện đại', sp.get('r') ?? 'living_room', num('n', 1));
      break;
    case 'banner':
      svg = bannerSvg(num('n', 1), sp.get('s') ?? 'Hiện đại');
      break;
    case 'avatar':
      svg = avatarSvg(sp.get('n') ?? 'A');
      break;
    default:
      return new Response('Not found', { status: 404 });
  }
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
