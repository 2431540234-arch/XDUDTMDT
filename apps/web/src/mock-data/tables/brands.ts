// Bảng `brands`
import type { Brand } from '@aurelia-living/shared-types';
import { registerMedia } from '../utils/media-registry';
import { avatarImg } from '../utils/img';

const names = ['Aurelia Home', 'Nordic Living', 'Oak & Co', 'Maison Luxe', 'Japandi Studio', 'Urban Nest'];

export const brands: Brand[] = names.map((name, i) => ({
  id: i + 1,
  name,
  slug: name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
  logoMediaId: registerMedia(avatarImg(name), `brand-${i + 1}.svg`, 'image/svg+xml', 1800, name),
  isActive: true,
  createdAt: '2026-01-02T08:00:00.000Z',
  updatedAt: '2026-01-02T08:00:00.000Z',
}));
