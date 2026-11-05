// Sinh các tệp GLB mẫu (khối hộp ghép thành sofa/bàn/ghế/giường/tủ/đèn) cho dữ liệu giả.
// Tự sinh nên không vướng bản quyền (CC0). Chạy: node apps/web/scripts/gen-mock-glb.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/mock/models');
mkdirSync(outDir, { recursive: true });

const hex = (h) => [0, 2, 4].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));

/** box: [cx, cy, cz, w, h, d, 'RRGGBB'] (đơn vị mét, y hướng lên, đáy chạm y=0) */
function boxGeometry([cx, cy, cz, w, h, d]) {
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
      pos.push(p[0] + cx, p[1] + cy, p[2] + cz);
      nor.push(...f.n);
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
  lamp: [
    [0, 0.02, 0, 0.3, 0.04, 0.3, '3B332E'],
    [0, 0.7, 0, 0.03, 1.4, 0.03, '3B332E'],
    [0, 1.45, 0, 0.42, 0.3, 0.42, 'F3EBE3'],
  ],
};

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
