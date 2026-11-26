// Phần dùng chung giữa seed-mock và update-real-images để đọc mock-data của Frontend khi chạy ngoài Next:
// ánh xạ alias `@/…`, dựng ảnh minh họa SVG và khóa lưu trữ của chúng (hai script phải ra CÙNG một khóa).
import { createHash } from 'node:crypto';
import Module from 'node:module';
import { resolve } from 'node:path';

export const WEB_SRC = resolve(__dirname, '../../web/src');

// Mock-data dùng alias `@/…` của Next.js → ánh xạ sang apps/web/src
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = Module as any;
const origResolve = M._resolveFilename;
M._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request.startsWith('@/')) request = resolve(WEB_SRC, request.slice(2));
  return origResolve.call(this, request, ...rest);
};

export const hex = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/** Khóa lưu trữ của một ảnh minh họa `/mock-img/…` */
export const illustrationKey = (url: string) => `mock/img/${hex(url)}.svg`;

export async function renderSvg(url: string): Promise<string | null> {
  const svgMod = await import(resolve(WEB_SRC, 'mock-data/utils/svg'));
  const u = new URL(url, 'http://x');
  const sp = u.searchParams;
  const kind = u.pathname.replace('/mock-img/', '').replace(/\.svg$/, '');
  const num = (k: string, d: number) => {
    const n = Number(sp.get(k));
    return Number.isFinite(n) && sp.get(k) !== null ? n : d;
  };
  switch (kind) {
    case 'product':
      return svgMod.productSvg(
        sp.get('t') ?? 'sofa',
        sp.get('c') ?? 'C9B6A0',
        num('v', 1),
        sp.get('l') ?? undefined,
      );
    case 'room':
      return svgMod.roomSvg(sp.get('s') ?? 'Hiện đại', sp.get('r') ?? 'living_room', num('n', 1));
    case 'pano':
      return svgMod.panoSvg(sp.get('s') ?? 'Hiện đại', sp.get('r') ?? 'living_room', num('n', 1));
    case 'banner':
      return svgMod.bannerSvg(num('n', 1), sp.get('s') ?? 'Hiện đại');
    case 'avatar':
      return svgMod.avatarSvg(sp.get('n') ?? 'A');
    default:
      return null;
  }
}
