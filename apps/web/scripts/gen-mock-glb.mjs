// Sinh các tệp GLB mẫu (khối hộp ghép thành sofa/bàn/ghế/giường/tủ/đèn) cho dữ liệu giả.
// Tự sinh nên không vướng bản quyền (CC0). Chạy: node apps/web/scripts/gen-mock-glb.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/mock/models');
mkdirSync(outDir, { recursive: true });

const hex = (h) => [0, 2, 4].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));

// Xoay quanh trục Z rồi quanh trục Y (radian)
function rot([x, y, z], ry, rz) {
  const x1 = x * Math.cos(rz) - y * Math.sin(rz);
  const y1 = x * Math.sin(rz) + y * Math.cos(rz);
  return [x1 * Math.cos(ry) + z * Math.sin(ry), y1, -x1 * Math.sin(ry) + z * Math.cos(ry)];
}

/** Đĩa tròn nằm ngang (h) hoặc đứng quay mặt ra +z (v), dựng bằng các thanh xoay đều quanh tâm */
function disc(cx, cy, cz, D, t, color, mode = 'h') {
  const k = 16;
  const w = D * 0.2;
  const out = [];
  for (let i = 0; i < k; i++) {
    const a = (i * Math.PI) / k;
    const tt = t + i * 0.0004; // tránh trùng mặt (z-fighting)
    out.push(mode === 'h' ? [cx, cy, cz, D, tt, w, color, a, 0] : [cx, cy, cz, D, w, tt, color, 0, a]);
  }
  return out;
}
const tint = (boxes, map) => boxes.map((b) => [...b.slice(0, 6), map[b[6]] ?? b[6], ...b.slice(7)]);

/** box: [cx, cy, cz, w, h, d, 'RRGGBB', rotY?, rotZ?] (đơn vị mét, y hướng lên, đáy chạm y=0) */
function boxGeometry([cx, cy, cz, w, h, d, , rotY = 0, rotZ = 0]) {
  const hx = w / 2,
    hy = h / 2,
    hz = d / 2;
  const faces = [
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
    {
      n: [0, -1, 0],
      v: [
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, -hy, hz],
        [-hx, -hy, hz],
      ],
    },
  ];
  const pos = [],
    nor = [],
    idx = [];
  faces.forEach((f, i) => {
    f.v.forEach((p) => {
      const q = rot(p, rotY, rotZ);
      pos.push(q[0] + cx, q[1] + cy, q[2] + cz);
      nor.push(...rot(f.n, rotY, rotZ));
    });
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { pos, nor, idx };
}

function buildGlb(name, boxes) {
  const byColor = new Map();
  for (const b of boxes) {
    const key = b[6];
    if (!byColor.has(key)) byColor.set(key, { pos: [], nor: [], idx: [] });
    const g = byColor.get(key);
    const bg = boxGeometry(b);
    const base = g.pos.length / 3;
    g.pos.push(...bg.pos);
    g.nor.push(...bg.nor);
    g.idx.push(...bg.idx.map((i) => i + base));
  }
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const primitives = [];
  let offset = 0;
  const pushBuf = (arr, Type, target) => {
    const buf = Buffer.from(new Type(arr).buffer);
    const pad = (4 - (buf.length % 4)) % 4;
    chunks.push(buf, Buffer.alloc(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    offset += buf.length + pad;
    return bufferViews.length - 1;
  };
  for (const [color, g] of byColor) {
    const posView = pushBuf(g.pos, Float32Array, 34962);
    const norView = pushBuf(g.nor, Float32Array, 34962);
    const idxView = pushBuf(g.idx, Uint16Array, 34963);
    const mins = [Infinity, Infinity, Infinity];
    const maxs = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.pos.length; i += 3)
      for (let k = 0; k < 3; k++) {
        mins[k] = Math.min(mins[k], g.pos[i + k]);
        maxs[k] = Math.max(maxs[k], g.pos[i + k]);
      }
    const aPos =
      accessors.push({
        bufferView: posView,
        componentType: 5126,
        count: g.pos.length / 3,
        type: 'VEC3',
        min: mins,
        max: maxs,
      }) - 1;
    const aNor =
      accessors.push({ bufferView: norView, componentType: 5126, count: g.nor.length / 3, type: 'VEC3' }) - 1;
    const aIdx =
      accessors.push({ bufferView: idxView, componentType: 5123, count: g.idx.length, type: 'SCALAR' }) - 1;
    materials.push({
      name: `mat_${color}`,
      pbrMetallicRoughness: { baseColorFactor: [...hex(color), 1], metallicFactor: 0, roughnessFactor: 0.85 },
    });
    primitives.push({
      attributes: { POSITION: aPos, NORMAL: aNor },
      indices: aIdx,
      material: materials.length - 1,
    });
  }
  const json = {
    asset: { version: '2.0', generator: 'aurelia-mock-glb (CC0)' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };
  let jsonBuf = Buffer.from(JSON.stringify(json));
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks);
  const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, jsonBuf, bh, bin]);
}

const models = {
  sofa: [
    [0, 0.42, 0, 2.0, 0.22, 0.9, 'C9B8A0'],
    [0, 0.72, -0.34, 2.0, 0.5, 0.22, 'B8A58B'],
    [-0.95, 0.55, 0, 0.18, 0.5, 0.9, 'B8A58B'],
    [0.95, 0.55, 0, 0.18, 0.5, 0.9, 'B8A58B'],
    [-0.4, 0.58, 0.05, 0.78, 0.14, 0.7, 'DCCDB6'],
    [0.4, 0.58, 0.05, 0.78, 0.14, 0.7, 'DCCDB6'],
    [-0.9, 0.15, 0.35, 0.07, 0.3, 0.07, '3B332E'],
    [0.9, 0.15, 0.35, 0.07, 0.3, 0.07, '3B332E'],
    [-0.9, 0.15, -0.35, 0.07, 0.3, 0.07, '3B332E'],
    [0.9, 0.15, -0.35, 0.07, 0.3, 0.07, '3B332E'],
  ],
  table: [
    [0, 0.74, 0, 1.6, 0.05, 0.8, 'A07C58'],
    [-0.7, 0.36, -0.3, 0.07, 0.72, 0.07, '6E5039'],
    [0.7, 0.36, -0.3, 0.07, 0.72, 0.07, '6E5039'],
    [-0.7, 0.36, 0.3, 0.07, 0.72, 0.07, '6E5039'],
    [0.7, 0.36, 0.3, 0.07, 0.72, 0.07, '6E5039'],
  ],
  chair: [
    [0, 0.45, 0, 0.5, 0.06, 0.5, 'C9B8A0'],
    [0, 0.75, -0.22, 0.5, 0.55, 0.06, 'B8A58B'],
    [-0.21, 0.22, -0.21, 0.05, 0.44, 0.05, '6E5039'],
    [0.21, 0.22, -0.21, 0.05, 0.44, 0.05, '6E5039'],
    [-0.21, 0.22, 0.21, 0.05, 0.44, 0.05, '6E5039'],
    [0.21, 0.22, 0.21, 0.05, 0.44, 0.05, '6E5039'],
  ],
  bed: [
    [0, 0.25, 0, 1.7, 0.3, 2.1, '6E5039'],
    [0, 0.5, 0.05, 1.6, 0.22, 2.0, 'EFE6D8'],
    [0, 0.7, -1.0, 1.7, 0.9, 0.1, 'A07C58'],
    [-0.4, 0.66, -0.7, 0.6, 0.12, 0.35, 'FFFFFF'],
    [0.4, 0.66, -0.7, 0.6, 0.12, 0.35, 'FFFFFF'],
  ],
  cabinet: [
    [0, 0.9, 0, 1.2, 1.8, 0.55, 'B8A58B'],
    [-0.3, 0.9, 0.285, 0.58, 1.7, 0.02, 'C9B8A0'],
    [0.3, 0.9, 0.285, 0.58, 1.7, 0.02, 'C9B8A0'],
    [-0.05, 0.9, 0.3, 0.025, 0.2, 0.03, '3B332E'],
    [0.05, 0.9, 0.3, 0.025, 0.2, 0.03, '3B332E'],
  ],
  armchair: [
    [0, 0.3, 0, 0.9, 0.22, 0.85, 'C9B8A0'],
    [0, 0.65, -0.34, 0.9, 0.7, 0.18, 'B8A58B'],
    [-0.43, 0.5, 0, 0.14, 0.4, 0.85, 'B8A58B'],
    [0.43, 0.5, 0, 0.14, 0.4, 0.85, 'B8A58B'],
    [0, 0.46, 0.03, 0.68, 0.12, 0.65, 'DCCDB6'],
    [-0.35, 0.08, 0.32, 0.06, 0.16, 0.06, '3B332E'],
    [0.35, 0.08, 0.32, 0.06, 0.16, 0.06, '3B332E'],
    [-0.35, 0.08, -0.32, 0.06, 0.16, 0.06, '3B332E'],
    [0.35, 0.08, -0.32, 0.06, 0.16, 0.06, '3B332E'],
  ],
  coffee_table: [
    [0, 0.4, 0, 1.0, 0.05, 0.6, 'A07C58'],
    [0, 0.15, 0, 0.9, 0.03, 0.5, '6E5039'],
    [-0.45, 0.19, -0.25, 0.05, 0.38, 0.05, '6E5039'],
    [0.45, 0.19, -0.25, 0.05, 0.38, 0.05, '6E5039'],
    [-0.45, 0.19, 0.25, 0.05, 0.38, 0.05, '6E5039'],
    [0.45, 0.19, 0.25, 0.05, 0.38, 0.05, '6E5039'],
  ],
  tv_stand: [
    [0, 0.25, 0, 1.8, 0.4, 0.4, 'A07C58'],
    [-0.45, 0.25, 0.205, 0.8, 0.32, 0.02, 'C9B8A0'],
    [0.45, 0.25, 0.205, 0.8, 0.32, 0.02, 'C9B8A0'],
    [-0.85, 0.025, 0.15, 0.06, 0.05, 0.06, '3B332E'],
    [0.85, 0.025, 0.15, 0.06, 0.05, 0.06, '3B332E'],
    [-0.85, 0.025, -0.15, 0.06, 0.05, 0.06, '3B332E'],
    [0.85, 0.025, -0.15, 0.06, 0.05, 0.06, '3B332E'],
  ],
  nightstand: [
    [0, 0.3, 0, 0.5, 0.5, 0.4, 'A07C58'],
    [0, 0.42, 0.205, 0.44, 0.18, 0.02, 'C9B8A0'],
    [0, 0.18, 0.205, 0.44, 0.18, 0.02, 'C9B8A0'],
    [0, 0.42, 0.22, 0.1, 0.02, 0.03, '3B332E'],
    [0, 0.18, 0.22, 0.1, 0.02, 0.03, '3B332E'],
    [-0.2, 0.025, 0.15, 0.05, 0.05, 0.05, '3B332E'],
    [0.2, 0.025, 0.15, 0.05, 0.05, 0.05, '3B332E'],
    [-0.2, 0.025, -0.15, 0.05, 0.05, 0.05, '3B332E'],
    [0.2, 0.025, -0.15, 0.05, 0.05, 0.05, '3B332E'],
  ],
  wardrobe: [
    [0, 1.0, 0, 1.8, 2.0, 0.6, 'C9B8A0'],
    [-0.45, 1.0, 0.305, 0.86, 1.9, 0.02, 'DCCDB6'],
    [0.45, 1.0, 0.305, 0.86, 1.9, 0.02, 'DCCDB6'],
    [-0.06, 1.0, 0.325, 0.025, 0.3, 0.03, '3B332E'],
    [0.06, 1.0, 0.325, 0.025, 0.3, 0.03, '3B332E'],
  ],
  bookshelf: [
    [-0.45, 0.9, 0, 0.04, 1.8, 0.3, 'A07C58'],
    [0.45, 0.9, 0, 0.04, 1.8, 0.3, 'A07C58'],
    [0, 0.02, 0, 0.9, 0.04, 0.3, 'A07C58'],
    [0, 0.45, 0, 0.9, 0.03, 0.3, 'A07C58'],
    [0, 0.9, 0, 0.9, 0.03, 0.3, 'A07C58'],
    [0, 1.35, 0, 0.9, 0.03, 0.3, 'A07C58'],
    [0, 1.78, 0, 0.94, 0.04, 0.3, 'A07C58'],
    [0, 0.9, -0.14, 0.9, 1.8, 0.02, '6E5039'],
    [-0.2, 0.62, 0, 0.3, 0.3, 0.22, 'C9B8A0'],
    [0.15, 1.08, 0, 0.35, 0.3, 0.22, '8E8E8E'],
    [-0.1, 1.55, 0, 0.4, 0.3, 0.22, 'DCCDB6'],
  ],
  beanbag: [
    [0, 0.18, 0, 0.8, 0.36, 0.8, 'C9B8A0'],
    [0, 0.42, 0, 0.6, 0.12, 0.6, 'DCCDB6'],
    [0, 0.62, -0.28, 0.6, 0.4, 0.22, 'B8A58B'],
  ],
  rug: [
    [0, 0.01, 0, 2.0, 0.02, 1.4, 'C9B8A0'],
    [0, 0.022, 0, 1.7, 0.004, 1.1, 'DCCDB6'],
    [0, 0.026, 0, 1.2, 0.004, 0.6, 'B8A58B'],
  ],
  mirror: [
    [0, 0.9, 0, 0.6, 1.7, 0.04, 'A07C58'],
    [0, 0.9, 0.022, 0.52, 1.62, 0.01, 'D8E6EC'],
    [-0.28, 0.04, -0.2, 0.04, 0.08, 0.5, '6E5039'],
    [0.28, 0.04, -0.2, 0.04, 0.08, 0.5, '6E5039'],
    [0, 0.8, -0.2, 0.04, 1.4, 0.04, '6E5039'],
  ],
  lamp: [
    [0, 0.02, 0, 0.3, 0.04, 0.3, '3B332E'],
    [0, 0.7, 0, 0.03, 1.4, 0.03, '3B332E'],
    [0, 1.45, 0, 0.42, 0.3, 0.42, 'F3EBE3'],
  ],
};

// ===== Mô hình riêng theo từng sản phẩm (đặc điểm khác nhau) =====
const four = (pts, y, w, h, d, c) => pts.map(([x, z]) => [x, y, z, w, h, d, c]);
models.mirror_round = [
  ...disc(0, 1.25, 0, 0.9, 0.05, 'B08D57', 'v'),
  ...disc(0, 1.25, 0.03, 0.78, 0.02, 'D8E6EC', 'v'),
  [0, 0.02, 0, 0.55, 0.04, 0.35, 'B08D57'],
  [0, 0.45, -0.05, 0.03, 0.8, 0.03, 'B08D57'],
];
models.rug_round = [
  ...disc(0, 0.01, 0, 1.8, 0.02, 'F3EBE3'),
  ...disc(0, 0.016, 0, 1.4, 0.02, 'E8DCC8'),
  ...disc(0, 0.022, 0, 0.9, 0.02, 'F3EBE3'),
];
models.coffee_round = [
  ...disc(0, 0.42, 0, 0.9, 0.05, 'A07C58'),
  [0, 0.2, 0, 0.1, 0.4, 0.1, '6E5039'],
  ...disc(0, 0.015, 0, 0.5, 0.03, '6E5039'),
];
models.coffee_nest = [
  [0.15, 0.45, 0, 0.9, 0.04, 0.5, 'A07C58'],
  [-0.15, 0.33, 0.1, 0.55, 0.04, 0.38, 'C9B8A0'],
  ...four(
    [
      [0.55, -0.2],
      [0.55, 0.2],
      [-0.25, -0.2],
      [-0.25, 0.2],
    ],
    0.22,
    0.04,
    0.44,
    0.04,
    '2B2B2B',
  ),
  ...four(
    [
      [-0.35, 0.0],
      [-0.35, 0.28],
      [0.0, 0.0],
      [0.0, 0.28],
    ],
    0.165,
    0.04,
    0.33,
    0.04,
    '2B2B2B',
  ),
];
models.coffee_stone = [
  [0, 0.4, 0, 1.1, 0.06, 0.6, 'E5E2DC'],
  [0, 0.36, 0, 1.0, 0.02, 0.5, '8E8E8E'],
  ...four(
    [
      [-0.5, -0.25],
      [0.5, -0.25],
      [-0.5, 0.25],
      [0.5, 0.25],
    ],
    0.185,
    0.03,
    0.37,
    0.03,
    '2B2B2B',
  ),
];
models.table_stone = [
  [0, 0.74, 0, 1.8, 0.06, 0.9, 'E5E2DC'],
  [-0.7, 0.36, 0, 0.08, 0.72, 0.7, '2B2B2B'],
  [0.7, 0.36, 0, 0.08, 0.72, 0.7, '2B2B2B'],
  [0, 0.15, 0, 1.4, 0.04, 0.04, '2B2B2B'],
];
models.table_ext = [
  [0, 0.74, 0, 2.4, 0.05, 0.9, 'A07C58'],
  [0, 0.766, 0, 0.02, 0.012, 0.9, '6E5039'],
  ...four(
    [
      [-1.1, -0.35],
      [1.1, -0.35],
      [-1.1, 0.35],
      [1.1, 0.35],
    ],
    0.36,
    0.07,
    0.72,
    0.07,
    '6E5039',
  ),
  [0, 0.65, 0, 2.0, 0.05, 0.08, '6E5039'],
];
models.tv_walnut = tint(models.tv_stand, { A07C58: '5C4033', C9B8A0: '7B5239' });
models.tv_wall = [
  [0, 0.9, -0.2, 2.2, 0.55, 0.03, 'E8DCC8'],
  [0, 0.9, 0, 1.9, 0.3, 0.35, 'F3EBE3'],
  [-0.5, 0.9, 0.18, 0.85, 0.26, 0.02, 'C9B8A0'],
  [0.5, 0.9, 0.18, 0.85, 0.26, 0.02, 'C9B8A0'],
  [0, 1.45, -0.19, 1.2, 0.7, 0.02, '2B2B2B'],
];
models.bookshelf_steel = [
  ...four(
    [
      [-0.45, -0.14],
      [0.45, -0.14],
      [-0.45, 0.14],
      [0.45, 0.14],
    ],
    0.9,
    0.025,
    1.8,
    0.025,
    '2B2B2B',
  ),
  ...[0.05, 0.5, 0.95, 1.4, 1.78].map((y) => [0, y, 0, 0.95, 0.03, 0.32, 'A07C58']),
  [0.1, 0.64, 0, 0.3, 0.26, 0.22, 'C9B8A0'],
  [-0.2, 1.1, 0, 0.3, 0.26, 0.22, '8E8E8E'],
];
models.shelf_wall = [
  [0, 0.9, -0.12, 1.2, 1.5, 0.02, 'F3EBE3'],
  ...[0.5, 0.95, 1.4].map((y) => [0, y, 0, 1.0, 0.04, 0.22, 'A07C58']),
  [-0.3, 0.6, 0, 0.18, 0.18, 0.15, 'C9B8A0'],
  [0.25, 1.08, 0, 0.25, 0.25, 0.15, '6B7D5C'],
  [-0.1, 1.53, 0, 0.3, 0.2, 0.15, 'E8DCC8'],
];
models.sofa_corner = [
  [0, 0.42, 0, 2.6, 0.22, 0.9, 'C9B8A0'],
  [0.85, 0.42, 1.2, 0.9, 0.22, 1.5, 'C9B8A0'],
  [0, 0.72, -0.34, 2.6, 0.5, 0.22, 'B8A58B'],
  [-1.25, 0.55, 0, 0.18, 0.5, 0.9, 'B8A58B'],
  [1.25, 0.55, 0.7, 0.18, 0.5, 2.3, 'B8A58B'],
  [-0.65, 0.58, 0.05, 1.1, 0.14, 0.7, 'DCCDB6'],
  [0.45, 0.58, 0.05, 1.0, 0.14, 0.7, 'DCCDB6'],
  [0.85, 0.58, 1.2, 0.7, 0.14, 1.3, 'DCCDB6'],
];
models.sofa_module = [
  [-1.0, 0.4, 0, 0.9, 0.4, 0.9, 'C9B8A0'],
  [0, 0.4, 0, 0.9, 0.4, 0.9, 'B8A58B'],
  [1.0, 0.4, 0, 0.9, 0.4, 0.9, 'C9B8A0'],
  [-1.0, 0.8, -0.38, 0.9, 0.5, 0.15, 'B8A58B'],
  [0, 0.8, -0.38, 0.9, 0.5, 0.15, 'C9B8A0'],
  [1.0, 0.8, -0.38, 0.9, 0.5, 0.15, 'B8A58B'],
];
models.sofa_slim = [
  [0, 0.38, 0, 1.8, 0.14, 0.75, 'D8C3A5'],
  [0, 0.62, -0.3, 1.8, 0.4, 0.12, 'D8C3A5'],
  ...four(
    [
      [-0.8, -0.3],
      [0.8, -0.3],
      [-0.8, 0.3],
      [0.8, 0.3],
    ],
    0.15,
    0.03,
    0.3,
    0.03,
    'A07C58',
  ),
];
models.sofa_leather = tint(models.sofa, { C9B8A0: '6E4B35', B8A58B: '5A3D2B', DCCDB6: '7B5239' });
models.sofa_bed = [...models.sofa, [0, 0.3, 0.75, 1.9, 0.1, 0.6, 'DCCDB6']];
models.bed_oak = tint(models.bed, { '6E5039': 'C9A26B', A07C58: 'D8B987' });
models.bed_upholstered = [
  [0, 0.25, 0, 1.7, 0.3, 2.1, '8E8E8E'],
  [0, 0.5, 0.05, 1.6, 0.22, 2.0, 'EFE6D8'],
  [0, 0.95, -1.0, 1.9, 1.4, 0.18, 'A8A8A8'],
  [-0.4, 0.66, -0.7, 0.6, 0.12, 0.35, 'FFFFFF'],
  [0.4, 0.66, -0.7, 0.6, 0.12, 0.35, 'FFFFFF'],
];
models.bed_bunk = [
  ...four(
    [
      [-0.9, -1.0],
      [0.9, -1.0],
      [-0.9, 1.0],
      [0.9, 1.0],
    ],
    0.9,
    0.08,
    1.8,
    0.08,
    '6E5039',
  ),
  [0, 0.4, 0, 1.8, 0.12, 2.1, 'A07C58'],
  [0, 0.5, 0, 1.7, 0.14, 2.0, 'EFE6D8'],
  [0, 1.4, 0, 1.8, 0.12, 2.1, 'A07C58'],
  [0, 1.5, 0, 1.7, 0.14, 2.0, 'EFE6D8'],
  ...[0.4, 0.8, 1.2].map((y) => [0.95, y, 0.8, 0.05, 0.04, 0.5, '6E5039']),
];
models.wardrobe_4 = [
  [0, 1.0, 0, 2.4, 2.0, 0.6, 'C9B8A0'],
  ...[-0.9, -0.3, 0.3, 0.9].map((x) => [x, 1.0, 0.305, 0.58, 1.9, 0.02, 'DCCDB6']),
  ...[-0.65, -0.05, 0.05, 0.65].map((x) => [x, 1.0, 0.325, 0.025, 0.3, 0.03, '3B332E']),
];
models.wardrobe_glass = [
  [0, 1.0, 0, 1.8, 2.0, 0.6, '8E8E8E'],
  [-0.45, 1.0, 0.305, 0.82, 1.9, 0.015, 'C9DDE5'],
  [0.45, 1.0, 0.305, 0.82, 1.9, 0.015, 'C9DDE5'],
  [0, 1.0, 0.32, 0.03, 1.9, 0.02, '2B2B2B'],
];
models.cabinet_wine = [
  [0, 0.9, 0, 0.9, 1.8, 0.4, '5C4033'],
  [0, 1.15, 0.205, 0.8, 1.2, 0.015, 'C9DDE5'],
  ...[0.55, 0.95, 1.35, 1.75].map((y) => [0, y, 0, 0.84, 0.02, 0.36, '7B5239']),
  ...[-0.25, 0, 0.25].flatMap((x) => [
    [x, 1.1, 0, 0.07, 0.28, 0.07, '3F6B3A'],
    [x, 1.55, 0, 0.07, 0.28, 0.07, '6B2D2D'],
  ]),
  [0, 0.28, 0.205, 0.8, 0.5, 0.02, '7B5239'],
];
models.nightstand_oak = [
  [0, 0.55, 0, 0.5, 0.04, 0.4, 'C9A26B'],
  [0, 0.28, 0, 0.5, 0.03, 0.4, 'C9A26B'],
  [0, 0.4, 0.17, 0.46, 0.18, 0.02, 'D8B987'],
  ...four(
    [
      [-0.23, -0.18],
      [0.23, -0.18],
      [-0.23, 0.18],
      [0.23, 0.18],
    ],
    0.28,
    0.035,
    0.56,
    0.035,
    '8A6A3F',
  ),
];
models.desk_l = [
  [0, 0.74, 0, 1.6, 0.04, 0.7, 'D8C3A5'],
  [0.45, 0.74, 0.9, 0.7, 0.04, 1.1, 'D8C3A5'],
  ...four(
    [
      [-0.75, -0.3],
      [0.75, -0.3],
      [-0.75, 0.3],
      [0.75, 0.3],
      [0.2, 1.4],
      [0.7, 1.4],
    ],
    0.36,
    0.05,
    0.72,
    0.05,
    '2B2B2B',
  ),
];
models.desk_stand = [
  [0, 1.05, 0, 1.4, 0.04, 0.7, 'D8C3A5'],
  [-0.55, 0.5, 0, 0.08, 1.0, 0.6, '2B2B2B'],
  [0.55, 0.5, 0, 0.08, 1.0, 0.6, '2B2B2B'],
  [0, 0.98, 0, 1.1, 0.06, 0.06, '2B2B2B'],
  [-0.55, 0.02, 0, 0.1, 0.04, 0.7, '2B2B2B'],
  [0.55, 0.02, 0, 0.1, 0.04, 0.7, '2B2B2B'],
];
models.office_chair = [
  [0, 0.5, 0, 0.5, 0.08, 0.5, '3B332E'],
  [0, 0.95, -0.22, 0.48, 0.7, 0.06, '3B332E'],
  [0, 0.28, 0, 0.05, 0.4, 0.05, '8E8E8E'],
  [0, 0.06, 0, 0.6, 0.04, 0.06, '2B2B2B'],
  [0, 0.06, 0, 0.06, 0.04, 0.6, '2B2B2B'],
  ...four(
    [
      [-0.3, 0],
      [0.3, 0],
      [0, -0.3],
      [0, 0.3],
    ],
    0.02,
    0.06,
    0.04,
    0.06,
    '8E8E8E',
  ),
  [-0.3, 0.7, 0, 0.05, 0.05, 0.3, '3B332E'],
  [0.3, 0.7, 0, 0.05, 0.05, 0.3, '3B332E'],
];
models.office_chair_boss = [
  ...tint(models.office_chair, { '3B332E': '4A2F20' }).filter((b) => b[1] !== 0.95),
  [0, 1.05, -0.22, 0.55, 0.95, 0.1, '4A2F20'],
  [0, 1.6, -0.22, 0.45, 0.2, 0.1, '4A2F20'],
];
models.chair_leather = tint(models.chair, { C9B8A0: '6E4B35', B8A58B: '5A3D2B' });
models.chair_fabric = tint(models.chair, { C9B8A0: '8E8E8E', B8A58B: '7A7A7A' });
models.armchair_nordic = [
  [0, 0.42, 0, 0.8, 0.12, 0.75, 'C9B8A0'],
  [0, 0.75, -0.33, 0.8, 0.6, 0.1, 'C9B8A0'],
  [-0.4, 0.55, 0, 0.05, 0.05, 0.75, 'A07C58'],
  [0.4, 0.55, 0, 0.05, 0.05, 0.75, 'A07C58'],
  ...four(
    [
      [-0.35, -0.3],
      [0.35, -0.3],
      [-0.35, 0.3],
      [0.35, 0.3],
    ],
    0.18,
    0.04,
    0.36,
    0.04,
    'A07C58',
  ),
];
models.lamp_table = [
  [0, 0.17, 0, 0.2, 0.34, 0.2, 'F3EBE3'],
  [0, 0.38, 0, 0.05, 0.1, 0.05, 'F3EBE3'],
  [0, 0.58, 0, 0.36, 0.28, 0.36, 'E8DCC8'],
];
models.lamp_pendant = [
  [0, 1.9, 0, 0.01, 1.0, 0.01, '3B332E'],
  [0, 1.4, 0, 0.5, 0.2, 0.3, 'F3EBE3'],
  [-0.12, 1.3, 0.05, 0.35, 0.2, 0.3, 'F3EBE3'],
  [0.15, 1.28, -0.04, 0.35, 0.22, 0.3, 'F3EBE3'],
  [0, 1.2, 0, 0.4, 0.18, 0.25, 'F3EBE3'],
];
models.lamp_deco = [
  [0, 0.03, 0, 0.3, 0.06, 0.3, '2B2B2B'],
  ...four(
    [
      [-0.13, -0.13],
      [0.13, -0.13],
      [-0.13, 0.13],
      [0.13, 0.13],
    ],
    0.33,
    0.02,
    0.5,
    0.02,
    'B08D57',
  ),
  [0, 0.33, 0, 0.24, 0.46, 0.24, 'F5EAD0'],
  [0, 0.62, 0, 0.3, 0.04, 0.3, 'B08D57'],
];

for (const [name, boxes] of Object.entries(models)) {
  const glb = buildGlb(name, boxes);
  writeFileSync(path.join(outDir, `${name}.glb`), glb);
  console.log(`✔ ${name}.glb (${glb.length} bytes)`);
}
// USDZ giữ chỗ (tệp ZIP rỗng hợp lệ) – chỉ để bản ghi định dạng USDZ trong admin có tệp; AR iOS thật cần USDZ thật.
writeFileSync(
  path.join(outDir, 'placeholder.usdz'),
  Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]),
);
console.log('✔ placeholder.usdz');
