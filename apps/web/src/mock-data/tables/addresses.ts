// Bảng `addresses`: 1–3 địa chỉ/khách, đúng 1 địa chỉ mặc định
import type { Address } from '@aurelia-living/shared-types';
import { addDays, iso, makeRng } from '../utils/rng';
import { provinces, streets } from '../utils/vi';
import { users } from './users';

const rng = makeRng(202);
export const addresses: Address[] = [];
/** label ("Nhà riêng"/"Văn phòng") chưa có cột trong DB */
export const addressLabels: Record<number, string> = {}; // TODO: chưa có trong DB
const labels = ['Nhà riêng', 'Văn phòng', 'Nhà bố mẹ'];

for (const u of users) {
  if (u.id === 1) continue;
  const n = u.id === 2 ? 2 : rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const p = u.id === 2 && i === 0 ? provinces[0] : rng.pick(provinces);
    const d = rng.pick(p.districts);
    const id = addresses.length + 1;
    const at = iso(addDays(new Date(u.createdAt), i));
    addresses.push({
      id,
      userId: u.id,
      recipientName:
        i === 0 || rng.chance(0.5)
          ? u.fullName
          : `${u.fullName.split(' ')[0]} ${rng.pick(['Thị Lan', 'Văn Hùng', 'Minh Tuấn'])}`,
      phone: u.phone ?? '0900000000',
      province: p.province,
      district: d.district,
      ward: rng.pick(d.wards),
      addressLine: `${rng.int(1, 250)} ${rng.pick(streets)}`,
      isDefault: i === 0,
      createdAt: at,
      updatedAt: at,
    });
    addressLabels[id] = labels[i];
  }
}
