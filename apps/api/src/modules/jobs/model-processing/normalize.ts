// Chuẩn hóa mô hình 3D (dùng chung cho mô hình AI và GLB admin tải lên) TRƯỚC khi sinh LOD. Hàm thuần.
//  1. sửa kiểu ảnh texture theo nội dung thật (Hunyuan3D ghi JPEG nhưng khai PNG ⇒ bước nén texture lỗi);
//  2. đặt lại metallic/roughness để màu gần ảnh gốc;
//  3. gỡ tấm sàn thừa (chỉ khi phát hiện tấm mỏng ở đáy rộng hơn rõ rệt phần còn lại);
//  4. xoay quanh trục đứng cho cạnh dài nằm đúng trục (trục đứng của glTF là Y), cộng góc admin chọn thêm;
//  5. co ĐỀU theo kích thước thật (mét), đặt đáy chạm sàn (Y = 0), căn giữa X/Z; báo khi tỉ lệ lệch quá 15%.
// Trục sau chuẩn hóa: X = dài, Y = cao, Z = rộng (sâu).
import { type Document, type Node, type Primitive } from '@gltf-transform/core';
import { dedup, prune, simplify, unweld, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { getIO, measure, readGlb } from './glb-tools';

export interface TargetSizeMm {
  length: number;
  width: number;
  height: number;
}

export interface NormalizeOptions {
  target: TargetSizeMm;
  /** nguồn của tệp: mô hình AI luôn đặt metallic = 0; tệp tải lên chỉ sửa khi khai kim loại mà không có map */
  source: 'ai' | 'upload';
  /** góc admin xoay thêm quanh trục đứng (độ, bội số của 90) */
  yawDeg?: number;
}

export interface NormalizeReport {
  fixes: { textureMime: number; materials: number };
  floorRemoved: boolean;
  floorTriangles: number;
  autoYawDeg: number;
  manualYawDeg: number;
  /** hệ số co đã áp (đơn vị của tệp → mét) */
  scale: number;
  targetMm: TargetSizeMm;
  measuredMm: TargetSizeMm;
  /** độ lệch từng chiều so với kích thước thật sau khi co đều (%) */
  deviationPct: TargetSizeMm;
  distorted: boolean;
  triangles: number;
  warnings: string[];
}

export interface FloorDetection {
  /** độ cao cắt tính theo tỉ lệ chiều cao mô hình */
  cutRatio: number;
  /** diện tích đáy toàn bộ / diện tích đáy phần phía trên tấm sàn */
  footprintRatio: number;
}

/** Lệch quá ngưỡng này (một chiều bất kỳ) thì cảnh báo mô hình méo */
export const DISTORTION_LIMIT_PCT = 15;
const MAX_TRIANGLES = 100_000;
/** tấm sàn: phải nằm trọn trong 10% chiều cao dưới cùng và làm diện tích đáy rộng hơn ít nhất 1,5 lần */
const FLOOR_MAX_RATIO = 0.1;
const FLOOR_MIN_FOOTPRINT_RATIO = 1.5;

type Vec3 = [number, number, number];
interface Tri {
  p: [Vec3, Vec3, Vec3];
  prim: Primitive;
  idx: [number, number, number];
}

// ---------------------------------------------------------------- sửa texture và vật liệu
export function sniffImageMime(image: Uint8Array): string | null {
  if (image[0] === 0xff && image[1] === 0xd8) return 'image/jpeg';
  if (image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47) return 'image/png';
  if (image[0] === 0x52 && image[1] === 0x49 && image[8] === 0x57 && image[9] === 0x45) return 'image/webp';
  return null;
}

export function fixTextureMime(doc: Document): number {
  let n = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage();
    const real = image && sniffImageMime(image);
    if (real && real !== tex.getMimeType()) {
      tex.setMimeType(real).setURI('');
      n++;
    }
  }
  return n;
}

export function fixMaterials(doc: Document, source: 'ai' | 'upload'): number {
  let n = 0;
  for (const m of doc.getRoot().listMaterials()) {
    const hasMap = Boolean(m.getMetallicRoughnessTexture());
    const wrongDefault = !hasMap && m.getMetallicFactor() >= 0.9;
    // đồ nội thất do AI dựng: vật liệu "kim loại" làm màu sẫm/ám hơn ảnh gốc
    if (wrongDefault || (source === 'ai' && m.getMetallicFactor() > 0)) {
      m.setMetallicFactor(0);
      if (!hasMap) m.setRoughnessFactor(0.8);
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- hình học
const apply = (m: number[], v: number[]): Vec3 => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];

/** Mọi tam giác của cảnh với tọa độ thế giới */
function triangles(doc: Document): Tri[] {
  const out: Tri[] = [];
  const seen = new Set<Primitive>();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix() as unknown as number[];
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (prim.getMode() !== 4 || !position || seen.has(prim)) continue;
      seen.add(prim);
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      const el: number[] = [0, 0, 0];
      const at = (i: number) => (indices ? indices.getScalar(i) : i);
      for (let i = 0; i + 2 < count; i += 3) {
        const idx: [number, number, number] = [at(i), at(i + 1), at(i + 2)];
        const p = idx.map((k) => apply(world, position.getElement(k, el))) as [Vec3, Vec3, Vec3];
        out.push({ p, prim, idx });
      }
    }
  }
  return out;
}

interface Box {
  min: Vec3;
  max: Vec3;
}
function boxOf(tris: Tri[]): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const t of tris)
    for (const v of t.p)
      for (let a = 0; a < 3; a++) {
        if (v[a] < min[a]) min[a] = v[a];
        if (v[a] > max[a]) max[a] = v[a];
      }
  return { min, max };
}
const footprint = (b: Box) => Math.max(0, b.max[0] - b.min[0]) * Math.max(0, b.max[2] - b.min[2]);
const below = (t: Tri, y: number) => t.p.every((v) => v[1] <= y);

/**
 * Phát hiện tấm phẳng mỏng ở đáy: tồn tại độ cao cắt ≤ 10% chiều cao mà phần PHÍA TRÊN có diện tích đáy nhỏ hơn
 * toàn mô hình ít nhất 1,5 lần, và phần phía trên vẫn là phần chính (đủ cao, đủ tam giác). Không thỏa ⇒ null
 * (ví dụ thảm: cả mô hình là một tấm mỏng nên không bị coi là sàn).
 */
export function detectFloorIn(tris: Tri[]): FloorDetection | null {
  if (!tris.length) return null;
  const all = boxOf(tris);
  const height = all.max[1] - all.min[1];
  const full = footprint(all);
  if (!(height > 0) || !(full > 0)) return null;
  const aboveAt = (ratio: number) => tris.filter((t) => !below(t, all.min[1] + height * ratio));
  const areaAt = (ratio: number) => {
    const rest = aboveAt(ratio);
    return rest.length ? footprint(boxOf(rest)) : 0;
  };
  const settled = areaAt(FLOOR_MAX_RATIO);
  if (!(settled > 0) || full / settled < FLOOR_MIN_FOOTPRINT_RATIO) return null;
  // độ cao cắt nhỏ nhất đã loại hết tấm sàn
  for (let step = 1; step <= FLOOR_MAX_RATIO * 200; step++) {
    const cutRatio = step / 200;
    if (areaAt(cutRatio) > settled * 1.05) continue;
    const rest = aboveAt(cutRatio);
    const restBox = boxOf(rest);
    if (rest.length < tris.length * 0.2 || restBox.max[1] - restBox.min[1] < height * 0.6) return null;
    return { cutRatio, footprintRatio: Math.round((full / settled) * 100) / 100 };
  }
  return null;
}

export async function detectFloor(source: Buffer): Promise<FloorDetection | null> {
  return detectFloorIn(triangles(await readGlb(source)));
}

/**
 * Bỏ tấm sàn: trong dải dưới độ cao cắt, bỏ các mặt NẰM NGANG và phần thò ra ngoài chân đế của phần còn lại.
 * Giữ mặt đứng nằm trong chân đế (đầu chân bàn, chân ghế) để không làm cụt chân.
 */
function removeFloor(doc: Document, floor: FloorDetection): number {
  const tris = triangles(doc);
  const all = boxOf(tris);
  const cut = all.min[1] + (all.max[1] - all.min[1]) * floor.cutRatio;
  const rest = boxOf(tris.filter((t) => !below(t, cut)));
  const marginX = (rest.max[0] - rest.min[0]) * 0.01;
  const marginZ = (rest.max[2] - rest.min[2]) * 0.01;
  const outside = (v: Vec3) =>
    v[0] < rest.min[0] - marginX ||
    v[0] > rest.max[0] + marginX ||
    v[2] < rest.min[2] - marginZ ||
    v[2] > rest.max[2] + marginZ;
  const horizontal = ([a, b, c]: [Vec3, Vec3, Vec3]) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    return len === 0 || Math.abs(n[1]) / len > 0.8;
  };
  const kept = new Map<Primitive, number[]>();
  let removed = 0;
  for (const t of tris) {
    const list = kept.get(t.prim) ?? [];
    kept.set(t.prim, list);
    if (below(t, cut) && (horizontal(t.p) || t.p.some(outside))) removed++;
    else list.push(...t.idx);
  }
  const buffer = doc.getRoot().listBuffers()[0];
  for (const [prim, list] of kept) {
    if (!list.length) {
      prim.dispose();
      continue;
    }
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(list)).setBuffer(buffer));
  }
  return removed;
}

/** Góc (độ, 0–90) quanh trục đứng cho hình chữ nhật bao hình chiếu mặt sàn nhỏ nhất */
function minAreaYaw(points: Vec3[]): number {
  const areaAt = (deg: number) => {
    const { x, z } = extentXZ(points, deg);
    return x * z;
  };
  let best = 0;
  let bestArea = areaAt(0);
  for (let deg = 0.5; deg < 90; deg += 0.5) {
    const a = areaAt(deg);
    if (a < bestArea) {
      best = deg;
      bestArea = a;
    }
  }
  // chỉ xoay khi lợi rõ (≥ 3%): tránh xoay lệch vài độ vì nhiễu
  return bestArea < areaAt(0) * 0.97 ? best : 0;
}

const rotateY = (v: Vec3, deg: number): Vec3 => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
};
function extentXZ(points: Vec3[], deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of points) {
    const x = c * p[0] + s * p[2];
    const z = -s * p[0] + c * p[2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return { x: x1 - x0, z: z1 - z0 };
}

const round = (n: number, digits = 0) => Math.round(n * 10 ** digits) / 10 ** digits;
const normalizeDeg = (d: number) => ((d % 360) + 360) % 360;

/** Chuẩn hóa MỘT phiên bản của mô hình. `floor` khác null ⇒ gỡ tấm sàn đã phát hiện. */
export async function normalizeModel(
  source: Buffer,
  options: NormalizeOptions,
  floor: FloorDetection | null = null,
): Promise<{ buffer: Buffer; report: NormalizeReport }> {
  const io = await getIO();
  const doc = await readGlb(source);
  const fixes = { textureMime: fixTextureMime(doc), materials: fixMaterials(doc, options.source) };
  for (const animation of doc.getRoot().listAnimations()) animation.dispose();
  await doc.transform(dedup(), weld());

  const floorTriangles = floor ? removeFloor(doc, floor) : 0;
  // bỏ đỉnh không còn dùng (sau khi gỡ sàn) rồi lập lại chỉ số
  await doc.transform(unweld(), weld(), prune());

  const before = measure(doc).polygonCount;
  if (before > MAX_TRIANGLES) {
    await MeshoptSimplifier.ready;
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIANGLES / before, error: 0.01 }),
      prune(),
    );
  }

  const tris = triangles(doc);
  if (!tris.length) throw new Error('Mô hình không còn tam giác nào sau khi chuẩn hóa.');
  const points = tris.flatMap((t) => t.p);
  const { target } = options;

  // hướng: hộp bao nhỏ nhất, rồi cạnh dài nằm đúng trục theo kích thước thật
  let autoYaw = minAreaYaw(points);
  const e = extentXZ(points, autoYaw);
  if (e.x >= e.z !== target.length >= target.width && Math.abs(e.x - e.z) > Math.max(e.x, e.z) * 0.02)
    autoYaw += 90;
  const manualYaw = normalizeDeg(options.yawDeg ?? 0);
  const yaw = normalizeDeg(autoYaw + manualYaw);

  const rotated = points.map((p) => rotateY(p, yaw));
  const box = boxOf(rotated.map((p) => ({ p: [p, p, p] }) as unknown as Tri));
  const size = { x: box.max[0] - box.min[0], y: box.max[1] - box.min[1], z: box.max[2] - box.min[2] };
  if (!(size.x > 0 && size.y > 0 && size.z > 0)) throw new Error('Mô hình phẳng hoặc rỗng, không co được.');

  // co đều: trung bình nhân của tỉ lệ ba chiều
  const ratios = [target.length / 1000 / size.x, target.height / 1000 / size.y, target.width / 1000 / size.z];
  const scale = Math.cbrt(ratios[0] * ratios[1] * ratios[2]);
  const measured = {
    length: size.x * scale * 1000,
    height: size.y * scale * 1000,
    width: size.z * scale * 1000,
  };
  const dev = (k: keyof TargetSizeMm) => round((measured[k] / target[k] - 1) * 100, 1);
  const deviationPct = { length: dev('length'), width: dev('width'), height: dev('height') };
  const distorted = Object.values(deviationPct).some((d) => Math.abs(d) > DISTORTION_LIMIT_PCT);

  // bọc toàn bộ cảnh trong một nút: xoay → co → đưa đáy về Y = 0 và tâm về gốc
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const half = (yaw * Math.PI) / 360;
  const root: Node = doc
    .createNode('normalized')
    .setRotation([0, Math.sin(half), 0, Math.cos(half)])
    .setScale([scale, scale, scale])
    .setTranslation([
      (-(box.min[0] + box.max[0]) / 2) * scale,
      -box.min[1] * scale,
      (-(box.min[2] + box.max[2]) / 2) * scale,
    ]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);
  doc.getRoot().setDefaultScene(scene);

  const warnings: string[] = [];
  if (distorted)
    warnings.push(
      `Tỉ lệ mô hình lệch hơn ${DISTORTION_LIMIT_PCT}% so với kích thước thật (dài ${deviationPct.length}%, rộng ${deviationPct.width}%, cao ${deviationPct.height}%).`,
    );
  if (floor) warnings.push(`Đã gỡ tấm sàn thừa (${floorTriangles} tam giác); hãy so với bản chưa gỡ.`);

  const buffer = Buffer.from(await io.writeBinary(doc));
  return {
    buffer,
    report: {
      fixes,
      floorRemoved: Boolean(floor),
      floorTriangles,
      autoYawDeg: normalizeDeg(autoYaw),
      manualYawDeg: manualYaw,
      scale: round(scale, 6),
      targetMm: target,
      measuredMm: {
        length: Math.max(1, round(measured.length)),
        width: Math.max(1, round(measured.width)),
        height: Math.max(1, round(measured.height)),
      },
      deviationPct,
      distorted,
      triangles: measure(doc).polygonCount,
      warnings,
    },
  };
}
