// Bảng `users`: 1 tài khoản Doanh nghiệp (admin) + 33 khách hàng (không có nhân viên).
import type { User, UserStatus } from '@aurelia-living/shared-types';
import { slugify } from '@/lib/format';
import { avatarImg } from '../utils/img';
import { registerMedia } from '../utils/media-registry';
import { addDays, iso, makeRng, MOCK_NOW } from '../utils/rng';
import { femaleFirst, femaleMiddle, lastNames, maleFirst, maleMiddle } from '../utils/vi';

const rng = makeRng(101);

/** Thông tin chỉ có ở mock (không có trong bảng users) – xem types/api.ts UserView */
export interface UserProfileExtra {
  userId: number;
  gender: 'male' | 'female' | 'other' | null; // TODO: chưa có trong DB
  birthday: string | null; // TODO: chưa có trong DB
  loyaltyPoints: number; // TODO: chưa có trong DB
  adminNote: string | null; // TODO: chưa có trong DB
}

export const TEST_CUSTOMER_ID = 2;
export const ADMIN_ID = 1;

export const users: User[] = [];
export const userProfiles: UserProfileExtra[] = [];
/** Mật khẩu thử (mock). Khách hàng 123456, admin admin123 */
export const credentials: Record<number, string> = {};

function add(
  name: string,
  email: string,
  gender: 'male' | 'female',
  status: UserStatus,
  createdDays: number,
  phone: string,
  birthYear: number,
  verified = true,
) {
  const id = users.length + 1;
  const created = iso(addDays(new Date('2026-01-01T08:00:00.000Z'), createdDays));
  const avatarMediaId = registerMedia(avatarImg(name), `avatar-${id}.svg`, 'image/svg+xml', 1800, name, id);
  users.push({
    id,
    uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    fullName: name,
    email,
    phone,
    avatarMediaId,
    status,
    emailVerifiedAt: verified ? created : null,
    lastLoginAt: iso(addDays(MOCK_NOW, -rng.int(0, 40))),
    deletedAt: null,
    createdAt: created,
    updatedAt: created,
  });
  userProfiles.push({
    userId: id,
    gender,
    birthday: `${birthYear}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
    loyaltyPoints: 0,
    adminNote: null,
  });
  credentials[id] = id === ADMIN_ID ? 'admin123' : '123456';
}

add('Nguyễn Văn A', 'admin@aurelia.vn', 'male', 'active', 0, '0901234567', 1988);
add('Trần Thu Hà', 'khachhang@aurelia.vn', 'female', 'active', 12, '0987654321', 1994);

const used = new Set<string>(['admin@aurelia.vn', 'khachhang@aurelia.vn']);
let made = 0;
while (made < 32) {
  const male = rng.chance(0.45);
  const name = `${rng.pick(lastNames)} ${rng.pick(male ? maleMiddle : femaleMiddle)} ${rng.pick(male ? maleFirst : femaleFirst)}`;
  const email = `${slugify(name).replace(/-/g, '.')}${rng.int(1, 99)}@gmail.com`;
  if (used.has(email)) continue;
  used.add(email);
  made++;
  // 3 tài khoản tạm khóa, 1 bị cấm, phần còn lại hoạt động
  const status: UserStatus =
    made === 7 || made === 15 || made === 26 ? 'suspended' : made === 21 ? 'banned' : 'active';
  const phone = `${rng.pick(['090', '091', '093', '097', '098', '032', '035', '077'])}${rng.int(1000000, 9999999)}`;
  add(
    name,
    email,
    male ? 'male' : 'female',
    status,
    rng.int(5, 300),
    phone,
    rng.int(1975, 2003),
    made % 9 !== 0,
  );
}

users.forEach((u) => {
  if (u.status === 'banned') {
    const p = userProfiles.find((x) => x.userId === u.id);
    if (p) p.adminNote = 'Tài khoản vi phạm điều khoản (hủy đơn liên tục), bị cấm từ 10/2026.';
  }
});
