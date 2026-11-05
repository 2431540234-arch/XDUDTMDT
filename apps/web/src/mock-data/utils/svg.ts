// Bộ tạo ảnh SVG minh họa (tông kem – nâu) cho dữ liệu giả: đồ nội thất, phòng mẫu, ảnh 360°, banner, avatar.
// Được route handler /mock-img/[kind] gọi → ảnh luôn có, không phải lưu hàng trăm file.

export type FurnitureType =
  | 'sofa'
  | 'armchair'
  | 'coffee_table'
  | 'tv_stand'
  | 'bed'
  | 'wardrobe'
  | 'nightstand'
  | 'dining_table'
  | 'dining_chair'
  | 'cabinet'
  | 'desk'
  | 'office_chair'
  | 'bookshelf'
  | 'lamp'
  | 'rug'
  | 'mirror'
  | 'beanbag';

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

export function shade(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return toHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(w: number, h: number, body: string, bg: [string, string]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#bg)"/>${body}</svg>`;
}

const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;

/** Hình đồ nội thất, nền tại y≈470 trong khung 800x600 */
function furniture(type: FurnitureType, c: string): string {
  const d1 = shade(c, -0.12);
  const d2 = shade(c, -0.25);
  const l1 = shade(c, 0.18);
  const wood = '#8a6a4f';
  const woodD = '#6e5039';
  const metal = '#3b332e';
  switch (type) {
    case 'sofa':
      return (
        rect(150, 250, 500, 150, d1, 34) +
        rect(105, 310, 100, 150, d2, 30) +
        rect(595, 310, 100, 150, d2, 30) +
        rect(180, 335, 440, 110, c, 20) +
        rect(190, 345, 205, 85, l1, 16) +
        rect(405, 345, 205, 85, l1, 16) +
        rect(175, 270, 450, 70, shade(c, -0.05), 24) +
        rect(140, 452, 18, 26, metal, 4) +
        rect(642, 452, 18, 26, metal, 4)
      );
    case 'armchair':
      return (
        rect(250, 230, 300, 170, d1, 40) +
        rect(205, 310, 90, 150, d2, 30) +
        rect(505, 310, 90, 150, d2, 30) +
        rect(270, 335, 260, 110, c, 22) +
        rect(285, 345, 230, 85, l1, 18) +
        rect(250, 452, 14, 26, woodD, 3) +
        rect(536, 452, 14, 26, woodD, 3)
      );
    case 'coffee_table':
      return (
        `<ellipse cx="400" cy="340" rx="230" ry="60" fill="${c}"/><ellipse cx="400" cy="330" rx="230" ry="58" fill="${l1}"/>` +
        rect(210, 340, 14, 120, woodD, 3) +
        rect(576, 340, 14, 120, woodD, 3) +
        rect(330, 372, 12, 98, woodD, 3) +
        rect(458, 372, 12, 98, woodD, 3)
      );
    case 'tv_stand':
      return (
        rect(150, 340, 500, 120, c, 8) +
        rect(150, 340, 500, 14, l1, 6) +
        rect(165, 362, 225, 90, d1, 6) +
        rect(410, 362, 225, 90, d1, 6) +
        rect(600, 460, 16, 18, woodD, 3) +
        rect(184, 460, 16, 18, woodD, 3) +
        rect(280, 190, 240, 140, '#1d1a18', 8) +
        rect(288, 198, 224, 124, '#2e2a27', 4) +
        rect(385, 330, 30, 10, metal, 2)
      );
    case 'bed':
      return (
        rect(150, 200, 500, 160, d2, 16) +
        rect(130, 340, 540, 110, c, 14) +
        rect(130, 330, 540, 40, l1, 14) +
        rect(180, 300, 180, 50, shade('#ffffff', -0.04), 22) +
        rect(440, 300, 180, 50, shade('#ffffff', -0.04), 22) +
        rect(130, 440, 26, 38, woodD, 4) +
        rect(644, 440, 26, 38, woodD, 4)
      );
    case 'wardrobe':
      return (
        rect(210, 120, 380, 350, c, 8) +
        rect(215, 128, 182, 334, d1, 4) +
        rect(403, 128, 182, 334, d1, 4) +
        rect(370, 280, 8, 50, metal, 3) +
        rect(422, 280, 8, 50, metal, 3) +
        rect(225, 468, 16, 12, woodD, 2) +
        rect(559, 468, 16, 12, woodD, 2)
      );
    case 'nightstand':
      return (
        rect(290, 270, 220, 190, c, 10) +
        rect(300, 290, 200, 70, d1, 6) +
        rect(300, 372, 200, 70, d1, 6) +
        rect(385, 318, 30, 8, metal, 3) +
        rect(385, 400, 30, 8, metal, 3) +
        rect(300, 460, 12, 18, woodD, 2) +
        rect(488, 460, 12, 18, woodD, 2)
      );
    case 'dining_table':
      return (
        rect(130, 270, 540, 30, l1, 8) +
        rect(140, 296, 520, 12, c, 4) +
        rect(180, 308, 22, 160, woodD, 4) +
        rect(598, 308, 22, 160, woodD, 4) +
        rect(250, 308, 14, 140, wood, 3) +
        rect(536, 308, 14, 140, wood, 3)
      );
    case 'dining_chair':
      return (
        rect(300, 170, 200, 150, d1, 22) +
        rect(285, 310, 230, 44, c, 14) +
        rect(298, 354, 16, 120, woodD, 4) +
        rect(486, 354, 16, 120, woodD, 4) +
        rect(330, 354, 12, 100, wood, 3) +
        rect(458, 354, 12, 100, wood, 3)
      );
    case 'cabinet':
      return (
        rect(250, 130, 300, 340, c, 8) +
        rect(262, 142, 276, 150, shade('#cfe0ea', 0.3) + '" opacity="0.55', 4) +
        rect(262, 300, 276, 20, d1, 3) +
        rect(262, 324, 276, 136, d1, 4) +
        rect(392, 380, 16, 8, metal, 3)
      );
    case 'desk':
      return (
        rect(130, 290, 540, 24, l1, 6) +
        rect(150, 312, 22, 156, woodD, 4) +
        rect(628, 312, 22, 156, woodD, 4) +
        rect(480, 314, 140, 120, c, 6) +
        rect(494, 330, 112, 40, d1, 4) +
        rect(494, 380, 112, 40, d1, 4) +
        rect(260, 200, 220, 90, '#1d1a18', 6) +
        rect(358, 290, 24, 10, metal, 2)
      );
    case 'office_chair':
      return (
        rect(300, 150, 200, 190, d1, 36) +
        rect(280, 330, 240, 50, c, 18) +
        rect(392, 380, 16, 80, metal, 4) +
        rect(310, 456, 180, 14, metal, 7) +
        `<circle cx="318" cy="482" r="9" fill="${metal}"/><circle cx="482" cy="482" r="9" fill="${metal}"/><circle cx="400" cy="486" r="9" fill="${metal}"/>`
      );
    case 'bookshelf':
      return (
        rect(240, 100, 320, 372, woodD, 6) +
        rect(252, 112, 296, 100, '#f3ebe3', 3) +
        rect(252, 222, 296, 100, '#f3ebe3', 3) +
        rect(252, 332, 296, 128, '#f3ebe3', 3) +
        rect(268, 130, 18, 80, c, 2) +
        rect(290, 140, 14, 70, d2, 2) +
        rect(310, 126, 20, 84, l1, 2) +
        rect(430, 240, 70, 80, c, 4) +
        rect(280, 350, 90, 108, d1, 4)
      );
    case 'lamp':
      return (
        `<polygon points="330,170 470,170 510,300 290,300" fill="${l1}"/>` +
        rect(396, 300, 8, 150, metal, 3) +
        `<ellipse cx="400" cy="462" rx="80" ry="14" fill="${metal}"/>` +
        `<ellipse cx="400" cy="300" rx="110" ry="14" fill="${c}" opacity="0.5"/>`
      );
    case 'rug':
      return `<ellipse cx="400" cy="420" rx="300" ry="86" fill="${c}"/><ellipse cx="400" cy="420" rx="250" ry="68" fill="none" stroke="${l1}" stroke-width="6"/><ellipse cx="400" cy="420" rx="190" ry="48" fill="${d1}" opacity="0.5"/>`;
    case 'mirror':
      return `<ellipse cx="400" cy="290" rx="130" ry="190" fill="${c}"/><ellipse cx="400" cy="290" rx="112" ry="172" fill="#dfeaf0"/><ellipse cx="360" cy="230" rx="30" ry="80" fill="#fff" opacity="0.45" transform="rotate(20 360 230)"/>`;
    case 'beanbag':
      return (
        `<ellipse cx="400" cy="400" rx="190" ry="90" fill="${c}"/>` +
        `<ellipse cx="400" cy="330" rx="150" ry="120" fill="${l1}"/>` +
        `<ellipse cx="400" cy="450" rx="190" ry="26" fill="${d1}" opacity="0.5"/>`
      );
  }
}

function floorShadow(type: FurnitureType): string {
  if (type === 'rug' || type === 'mirror') return '';
  return `<ellipse cx="400" cy="486" rx="300" ry="20" fill="#2b1e16" opacity="0.1"/>`;
}

const bgByView: Array<[string, string]> = [
  ['#f7f1ea', '#eadfd3'],
  ['#f3ebe3', '#e5d8c9'],
  ['#faf6f2', '#efe5da'],
  ['#efe4d6', '#dcc9b3'],
  ['#f0f2ef', '#dde1db'],
];

/** Ảnh sản phẩm: type = loại đồ, color = màu chính (hex không '#'), view = 1..5 */
export function productSvg(type: FurnitureType, color: string, view: number, label?: string): string {
  const c = `#${color.replace('#', '')}`;
  const v = Math.max(1, Math.min(5, view));
  const bg = bgByView[v - 1];
  let scene = '';
  if (v === 4) {
    scene +=
      rect(0, 0, 800, 470, '#efe4d6') +
      rect(0, 470, 800, 130, '#d3bda1') +
      rect(60, 70, 150, 190, '#fdfbf8', 4) +
      rect(66, 76, 138, 178, '#cfe1ea', 2) +
      rect(134, 76, 4, 178, '#fdfbf8') +
      `<rect x="590" y="330" width="40" height="140" fill="#6e5039"/><ellipse cx="610" cy="320" rx="54" ry="60" fill="#6b8f62"/>`;
  }
  const scale = v === 3 ? 1.55 : v === 2 ? 0.92 : 1;
  const tx = 400 - 400 * scale;
  const ty = v === 3 ? 470 - 470 * scale - 40 : 470 - 470 * scale;
  const tag = label
    ? `<text x="24" y="40" font-family="sans-serif" font-size="20" fill="#7a6e66">${esc(label)}</text>`
    : '';
  const body = `${scene}<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale})">${floorShadow(type)}${furniture(type, c)}</g>${tag}`;
  return wrap(800, 600, body, bg);
}

// ---------- Phòng mẫu / ảnh 360° ----------
const styleTone: Record<string, { wall: string; floor: string; accent: string; light: string }> = {
  'Hiện đại': { wall: '#e9e3dc', floor: '#b79f86', accent: '#8b4a2b', light: '#fffaf2' },
  'Bắc Âu': { wall: '#f1eee9', floor: '#d9c4a6', accent: '#7b9bb5', light: '#ffffff' },
  'Tối giản': { wall: '#efefec', floor: '#c9c3ba', accent: '#4a4642', light: '#ffffff' },
  Japandi: { wall: '#e8dfd1', floor: '#a98763', accent: '#5f6f52', light: '#fff7ea' },
  'Cổ điển': { wall: '#e4d3bc', floor: '#7a5538', accent: '#7a2e2e', light: '#fff1d6' },
  Luxury: { wall: '#d9cfc4', floor: '#4d3a2e', accent: '#c09a4a', light: '#fff2d0' },
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/** Ảnh phòng (tỉ lệ 4:3) để làm ảnh đại diện không gian mẫu / banner */
export function roomSvg(style: string, room: string, seed: number, w = 1200, h = 800): string {
  const t = styleTone[style] ?? styleTone['Hiện đại'];
  const horizon = h * 0.62;
  let items = '';
  const sofaC = pick(['#c9b8a0', '#a58b6f', '#8e9a8a', '#c4a98e', '#6f6a64'], seed);
  const cx = w / 2;
  items += `<rect x="${cx - 260}" y="${horizon - 230}" width="520" height="150" rx="6" fill="${shade(t.wall, -0.06)}"/>`; // tranh treo
  items += `<rect x="${cx - 232}" y="${horizon - 205}" width="190" height="100" fill="${t.accent}" opacity="0.8"/><rect x="${cx - 20}" y="${horizon - 205}" width="230" height="100" fill="${shade(t.accent, 0.4)}"/>`;
  if (room === 'bedroom') {
    items += `<rect x="${cx - 330}" y="${horizon - 80}" width="660" height="140" rx="14" fill="${sofaC}"/><rect x="${cx - 330}" y="${horizon - 120}" width="660" height="70" rx="12" fill="${shade(sofaC, -0.15)}"/><rect x="${cx - 300}" y="${horizon - 90}" width="190" height="46" rx="20" fill="#fbf8f3"/><rect x="${cx + 110}" y="${horizon - 90}" width="190" height="46" rx="20" fill="#fbf8f3"/>`;
  } else if (room === 'dining_room') {
    items += `<rect x="${cx - 280}" y="${horizon - 10}" width="560" height="22" rx="6" fill="${shade(t.floor, 0.25)}"/><rect x="${cx - 250}" y="${horizon + 10}" width="18" height="110" fill="${shade(t.floor, -0.3)}"/><rect x="${cx + 232}" y="${horizon + 10}" width="18" height="110" fill="${shade(t.floor, -0.3)}"/>`;
    for (const dx of [-210, -70, 70, 210])
      items += `<rect x="${cx + dx - 36}" y="${horizon - 70}" width="72" height="58" rx="10" fill="${sofaC}"/>`;
  } else if (room === 'office') {
    items += `<rect x="${cx - 300}" y="${horizon - 50}" width="600" height="20" rx="4" fill="${shade(t.floor, 0.3)}"/><rect x="${cx - 280}" y="${horizon - 30}" width="16" height="130" fill="${shade(t.floor, -0.3)}"/><rect x="${cx + 264}" y="${horizon - 30}" width="16" height="130" fill="${shade(t.floor, -0.3)}"/><rect x="${cx - 100}" y="${horizon - 150}" width="200" height="100" rx="6" fill="#1d1a18"/>`;
  } else {
    items += `<rect x="${cx - 350}" y="${horizon - 40}" width="700" height="150" rx="30" fill="${shade(sofaC, -0.1)}"/><rect x="${cx - 310}" y="${horizon + 10}" width="620" height="90" rx="20" fill="${sofaC}"/><rect x="${cx - 400}" y="${horizon + 20}" width="90" height="120" rx="26" fill="${shade(sofaC, -0.2)}"/><rect x="${cx + 310}" y="${horizon + 20}" width="90" height="120" rx="26" fill="${shade(sofaC, -0.2)}"/><ellipse cx="${cx}" cy="${horizon + 170}" rx="210" ry="40" fill="${shade(t.floor, 0.2)}"/>`;
  }
  const body =
    rect(0, 0, w, horizon, t.wall) +
    rect(0, horizon, w, h - horizon, t.floor) +
    `<rect x="0" y="${horizon - 6}" width="${w}" height="12" fill="${shade(t.wall, -0.12)}"/>` +
    `<rect x="70" y="60" width="170" height="${horizon - 140}" fill="#fdfbf8"/><rect x="80" y="70" width="150" height="${horizon - 160}" fill="#cfe1ea"/>` +
    `<ellipse cx="${w - 120}" cy="${horizon + 20}" rx="42" ry="14" fill="#2b1e16" opacity="0.15"/><rect x="${w - 128}" y="${horizon - 90}" width="16" height="110" fill="#6e5039"/><ellipse cx="${w - 120}" cy="${horizon - 100}" rx="50" ry="54" fill="#6b8f62"/>` +
    `<circle cx="${w - 320}" cy="90" r="34" fill="${t.light}" opacity="0.9"/><rect x="${w - 321}" y="0" width="2" height="60" fill="#8a7a6a"/>` +
    items;
  return wrap(w, h, body, [t.wall, shade(t.wall, -0.08)]);
}

/** Ảnh equirectangular 2:1 (360°) mô phỏng: sàn, tường 4 mặt có cửa sổ/tranh – đủ để thấy xoay */
export function panoSvg(style: string, room: string, seed: number): string {
  const t = styleTone[style] ?? styleTone['Hiện đại'];
  const w = 2048;
  const h = 1024;
  const hor = h * 0.56;
  let b = rect(0, 0, w, hor, t.wall) + rect(0, hor, w, h - hor, t.floor);
  b += rect(0, 0, w, 90, shade(t.wall, 0.4)); // trần
  b += rect(0, hor - 8, w, 14, shade(t.wall, -0.15));
  for (let i = 0; i < 4; i++) {
    const x0 = i * 512;
    b += rect(x0 + 6, 0, 4, hor, shade(t.wall, -0.22)); // góc tường
    if (i % 2 === 0)
      b +=
        rect(x0 + 130, 150, 250, 240, '#fdfbf8') +
        rect(x0 + 142, 162, 226, 216, '#cfe1ea') +
        rect(x0 + 252, 162, 4, 216, '#fdfbf8');
    else
      b +=
        rect(x0 + 120, 180, 270, 160, shade(t.accent, 0.1)) +
        rect(x0 + 140, 200, 230, 120, shade(t.accent, 0.5));
  }
  const sofaC = pick(['#c9b8a0', '#a58b6f', '#8e9a8a', '#c4a98e'], seed);
  // đồ đạc nằm ở 4 hướng
  const furnitureBlock = (x: number, kind: number) => {
    if (room === 'bedroom' && kind === 0)
      return (
        rect(x - 190, hor - 60, 380, 120, sofaC, 12) +
        rect(x - 190, hor - 110, 380, 60, shade(sofaC, -0.2), 10)
      );
    if (room === 'dining_room' && kind === 0)
      return (
        rect(x - 200, hor - 6, 400, 18, shade(t.floor, 0.3), 5) +
        rect(x - 180, hor + 12, 14, 90, shade(t.floor, -0.3)) +
        rect(x + 166, hor + 12, 14, 90, shade(t.floor, -0.3))
      );
    if (kind === 0)
      return (
        rect(x - 230, hor - 70, 460, 150, shade(sofaC, -0.1), 28) +
        rect(x - 200, hor - 10, 400, 90, sofaC, 18)
      );
    if (kind === 1)
      return (
        rect(x - 120, hor - 6, 240, 18, shade(t.floor, 0.3), 5) +
        rect(x - 105, hor + 12, 12, 80, shade(t.floor, -0.3)) +
        rect(x + 93, hor + 12, 12, 80, shade(t.floor, -0.3))
      );
    if (kind === 2)
      return (
        rect(x - 170, hor - 90, 340, 170, shade(t.accent, 0.25), 6) +
        rect(x - 160, hor - 80, 150, 150, shade(t.accent, 0.5), 3)
      );
    return (
      rect(x - 14, hor - 150, 28, 230, '#6e5039') +
      `<ellipse cx="${x}" cy="${hor - 170}" rx="80" ry="90" fill="#6b8f62"/>`
    );
  };
  b += furnitureBlock(256, 0) + furnitureBlock(768, 1) + furnitureBlock(1280, 2) + furnitureBlock(1792, 3);
  b += `<ellipse cx="256" cy="${hor + 180}" rx="220" ry="46" fill="${shade(t.floor, 0.2)}"/>`;
  b += `<text x="1024" y="${h - 40}" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#ffffff" opacity="0.6">Ảnh 360° minh họa · ${esc(style)}</text>`;
  return wrap(w, h, b, [t.wall, t.floor]);
}

/** Banner/hero rộng 16:7 với dòng chữ nhỏ ở góc */
export function bannerSvg(seed: number, style: string, w = 1600, h = 700): string {
  const base = roomSvg(style, pick(['living_room', 'bedroom', 'dining_room', 'office'], seed), seed, w, h);
  return base;
}

/** Avatar chữ cái đầu trên nền màu */
export function avatarSvg(name: string): string {
  const colors = ['#8b4a2b', '#a77b52', '#6b8f62', '#5b8db8', '#7b6cb5', '#c0605a', '#b8893d'];
  let hsh = 0;
  for (const ch of name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = colors[hsh % colors.length];
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="${bg}"/><text x="60" y="76" text-anchor="middle" font-family="sans-serif" font-size="46" font-weight="700" fill="#fff">${esc(ini)}</text></svg>`;
}

/** Ảnh vật liệu nhỏ (ảnh đánh giá của khách) */
export function reviewPhotoSvg(type: FurnitureType, color: string, seed: number): string {
  return productSvg(type, color, 4 + (seed % 2 ? 0 : 0), undefined);
}
