// Sinh ảnh 36 frame (10°/frame) cho tính năng "Xem 360°" của dữ liệu giả.
// Mỗi sản phẩm × màu → apps/web/public/mock/360/<product-slug>/<color-slug>/frame-01..36.svg
// Hình đồ nội thất dựng bằng các khối hộp được xoay thật quanh trục dọc (phối cảnh, đổ bóng, che khuất) nên
// khi xoay thấy rõ chuyển động; góc ảnh (0°, 10°…) được ghi ở góc để dễ kiểm tra.
// Nguồn danh sách: scripts/mock-360-products.json (dùng chung với mock-data). Chạy: node apps/web/scripts/gen-mock-360.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(path.join(here, 'mock-360-products.json'), 'utf8'));
const outRoot = path.resolve(here, '../public/mock/360');

const slugify = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (r, g, b) =>
  `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
const shade = (hex, k) => {
  const [r, g, b] = parse(hex);
  return k < 0
    ? toHex(r * (1 + k), g * (1 + k), b * (1 + k))
    : toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
};

/** [cx, cy, cz, w, h, d, vai trò]; vai trò: m=màu chính, d=tối hơn, l=sáng hơn, w=gỗ, k=kim loại, s=màn hình, p=trắng */
const SHAPES = {
  sofa: [
    [0, 0.42, 0, 2.0, 0.22, 0.9, 'm'],
    [0, 0.76, -0.34, 2.0, 0.55, 0.22, 'd'],
    [-0.95, 0.58, 0, 0.18, 0.55, 0.9, 'd'],
    [0.95, 0.58, 0, 0.18, 0.55, 0.9, 'd'],
    [-0.4, 0.6, 0.06, 0.78, 0.14, 0.7, 'l'],
    [0.4, 0.6, 0.06, 0.78, 0.14, 0.7, 'l'],
    [-0.9, 0.15, 0.35, 0.07, 0.3, 0.07, 'k'],
    [0.9, 0.15, 0.35, 0.07, 0.3, 0.07, 'k'],
    [-0.9, 0.15, -0.35, 0.07, 0.3, 0.07, 'k'],
    [0.9, 0.15, -0.35, 0.07, 0.3, 0.07, 'k'],
  ],
  armchair: [
    [0, 0.4, 0, 0.9, 0.2, 0.85, 'm'],
    [0, 0.78, -0.35, 0.9, 0.6, 0.2, 'd'],
    [-0.5, 0.55, 0, 0.16, 0.5, 0.85, 'd'],
    [0.5, 0.55, 0, 0.16, 0.5, 0.85, 'd'],
    [0, 0.56, 0.05, 0.7, 0.14, 0.62, 'l'],
    [-0.4, 0.15, 0.35, 0.06, 0.3, 0.06, 'w'],
    [0.4, 0.15, 0.35, 0.06, 0.3, 0.06, 'w'],
    [-0.4, 0.15, -0.35, 0.06, 0.3, 0.06, 'w'],
    [0.4, 0.15, -0.35, 0.06, 0.3, 0.06, 'w'],
  ],
  bed: [
    [0, 0.22, 0, 1.7, 0.3, 2.1, 'w'],
    [0, 0.5, 0.05, 1.6, 0.24, 2.0, 'p'],
    [0, 0.45, 0.45, 1.62, 0.3, 1.1, 'm'],
    [0, 0.85, -1.0, 1.7, 1.0, 0.12, 'd'],
    [-0.42, 0.7, -0.7, 0.6, 0.14, 0.36, 'l'],
    [0.42, 0.7, -0.7, 0.6, 0.14, 0.36, 'l'],
  ],
  table: [
    [0, 0.74, 0, 1.8, 0.06, 0.9, 'm'],
    [-0.8, 0.36, -0.35, 0.08, 0.72, 0.08, 'd'],
    [0.8, 0.36, -0.35, 0.08, 0.72, 0.08, 'd'],
    [-0.8, 0.36, 0.35, 0.08, 0.72, 0.08, 'd'],
    [0.8, 0.36, 0.35, 0.08, 0.72, 0.08, 'd'],
    [0, 0.68, 0, 1.5, 0.06, 0.6, 'd'],
  ],
  desk: [
    [0, 0.74, 0, 1.4, 0.05, 0.7, 'm'],
    [-0.65, 0.36, 0, 0.05, 0.72, 0.62, 'd'],
    [0.2, 0.36, 0, 0.6, 0.7, 0.55, 'd'],
    [0.2, 0.55, 0.28, 0.5, 0.2, 0.02, 'l'],
    [0.2, 0.25, 0.28, 0.5, 0.2, 0.02, 'l'],
    [-0.25, 1.02, -0.15, 0.55, 0.32, 0.03, 'k'],
    [-0.25, 0.8, -0.15, 0.06, 0.12, 0.06, 'k'],
  ],
  wardrobe: [
    [0, 1.0, 0, 1.6, 2.0, 0.6, 'm'],
    [-0.4, 1.0, 0.31, 0.78, 1.9, 0.02, 'd'],
    [0.4, 1.0, 0.31, 0.78, 1.9, 0.02, 'd'],
    [-0.06, 1.0, 0.33, 0.03, 0.3, 0.03, 'k'],
    [0.06, 1.0, 0.33, 0.03, 0.3, 0.03, 'k'],
    [-0.65, 0.04, 0.25, 0.1, 0.08, 0.1, 'k'],
    [0.65, 0.04, 0.25, 0.1, 0.08, 0.1, 'k'],
  ],
  lamp: [
    [0, 0.02, 0, 0.34, 0.04, 0.34, 'k'],
    [0, 0.75, 0, 0.035, 1.5, 0.035, 'k'],
    [0, 1.58, 0, 0.5, 0.34, 0.5, 'm'],
  ],
};

const ROLE = (role, main) =>
  ({
    m: main,
    d: shade(main, -0.22),
    l: shade(main, 0.18),
    w: '#8a6a4f',
    k: '#3b332e',
    s: '#1d1a18',
    p: '#f5f1ea',
  })[role];

const W = 800;
const H = 600;
const ELEV = (16 * Math.PI) / 180;
const LIGHT = (() => {
  const v = [-0.45, 0.8, 0.4];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

function frameSvg(shape, mainHex, deg) {
  const th = (deg * Math.PI) / 180;
  const cT = Math.cos(th),
    sT = Math.sin(th),
    cE = Math.cos(ELEV),
    sE = Math.sin(ELEV);
  const rot = ([x, y, z]) => {
    const x1 = x * cT + z * sT;
    const z1 = -x * sT + z * cT;
    return [x1, y * cE - z1 * sE, y * sE + z1 * cE];
  };
  const S = shape === 'lamp' ? 230 : shape === 'wardrobe' ? 190 : shape === 'bed' ? 215 : 250;
  const gy = 470;
  const proj = ([x, y, z]) => [W / 2 + x * S, gy - (y - 0.0) * S + z * 0];
  const faces = [];
  for (const [cx, cy, cz, w, h, d, role] of SHAPES[shape]) {
    const base = ROLE(role, mainHex);
    const hx = w / 2,
      hy = h / 2,
      hz = d / 2;
    const defs = [
      {
        n: [0, 0, 1],
        v: [
          [-hx, -hy, hz],
          [hx, -hy, hz],
          [hx, hy, hz],
          [-hx, hy, hz],
        ],
      },
      {
        n: [0, 0, -1],
        v: [
          [hx, -hy, -hz],
          [-hx, -hy, -hz],
          [-hx, hy, -hz],
          [hx, hy, -hz],
        ],
      },
      {
        n: [1, 0, 0],
        v: [
          [hx, -hy, hz],
          [hx, -hy, -hz],
          [hx, hy, -hz],
          [hx, hy, hz],
        ],
      },
      {
        n: [-1, 0, 0],
        v: [
          [-hx, -hy, -hz],
          [-hx, -hy, hz],
          [-hx, hy, hz],
          [-hx, hy, -hz],
        ],
      },
      {
        n: [0, 1, 0],
        v: [
          [-hx, hy, hz],
          [hx, hy, hz],
          [hx, hy, -hz],
          [-hx, hy, -hz],
        ],
      },
    ];
    for (const f of defs) {
      const rn = rot(f.n);
      if (rn[2] <= 0) continue; // mặt quay lưng khỏi camera (camera ở phía z dương)
      const pts = f.v.map((p) => rot([p[0] + cx, p[1] + cy, p[2] + cz]));
      const depth = pts.reduce((s, p) => s + p[2], 0) / 4;
      const lit = Math.max(0, rn[0] * LIGHT[0] + rn[1] * LIGHT[1] + rn[2] * LIGHT[2]);
      faces.push({ depth, fill: shade(base, -0.28 + lit * 0.5), pts: pts.map(proj) });
    }
  }
  faces.sort((a, b) => a.depth - b.depth); // vẽ mặt xa trước, gần sau
  const polys = faces
    .map(
      (f) =>
        `<polygon points="${f.pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${f.fill}" stroke="${shade(f.fill, -0.25)}" stroke-width="0.6" stroke-linejoin="round"/>`,
    )
    .join('');
  const rx = shape === 'lamp' ? 120 : 300;
  const shadowShift = Math.sin(th) * 25;
  const label = `${String(deg).padStart(3, '0')}°`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9f4ee"/><stop offset="1" stop-color="#e8dccd"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><ellipse cx="${(W / 2 + shadowShift).toFixed(0)}" cy="${gy + 8}" rx="${rx}" ry="26" fill="#2b1e16" opacity="0.13"/>${polys}<text x="24" y="42" font-family="sans-serif" font-size="22" font-weight="700" fill="#7a6e66">${label}</text><text x="${W - 24}" y="${H - 20}" text-anchor="end" font-family="sans-serif" font-size="13" fill="#a89a8e">Ảnh minh họa 360°</text></svg>`;
}

rmSync(outRoot, { recursive: true, force: true });
let count = 0;
for (const p of cfg.products) {
  for (const colorName of p.colors) {
    const dir = path.join(outRoot, slugify(p.name), slugify(colorName));
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < cfg.frameCount; i++) {
      const deg = Math.round((360 / cfg.frameCount) * i);
      writeFileSync(
        path.join(dir, `frame-${String(i + 1).padStart(2, '0')}.svg`),
        frameSvg(p.shape, cfg.colors[colorName], deg),
      );
      count++;
    }
  }
}
console.log(`✔ Đã sinh ${count} frame vào ${outRoot}`);
