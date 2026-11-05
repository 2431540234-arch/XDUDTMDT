// Tạo URL ảnh minh họa (route /mock-img – xem src/app/mock-img/[kind]/route.ts)
import type { FurnitureType } from './svg';

export const productImg = (type: FurnitureType, colorHex: string, view: number) =>
  `/mock-img/product?t=${type}&c=${colorHex.replace('#', '')}&v=${view}`;
export const roomImg = (style: string, room: string, n: number) =>
  `/mock-img/room?s=${encodeURIComponent(style)}&r=${room}&n=${n}`;
export const panoImg = (style: string, room: string, n: number) =>
  `/mock-img/pano?s=${encodeURIComponent(style)}&r=${room}&n=${n}`;
export const bannerImg = (style: string, n: number) =>
  `/mock-img/banner?s=${encodeURIComponent(style)}&n=${n}`;
export const avatarImg = (name: string) => `/mock-img/avatar?n=${encodeURIComponent(name)}`;
