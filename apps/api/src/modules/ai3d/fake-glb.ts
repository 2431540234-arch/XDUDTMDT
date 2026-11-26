// Sinh GLB nhỏ trong bộ nhớ cho FakeProvider và test (không cần tệp mô hình trong git). Có thể tái hiện đúng những
// lỗi đã gặp ở mô hình AI thật: tấm sàn thừa, ảnh JPEG khai là PNG, vật liệu metallic = 1, mô hình bị xoay.
import { Document } from '@gltf-transform/core';
import sharp from 'sharp';
import { getIO } from '../jobs/model-processing/glb-tools';

export interface FakeGlbOptions {
  /** dài (X), cao (Y), rộng (Z) của bàn giả, đơn vị tùy ý */
  size?: [number, number, number];
  floor?: boolean;
  jpegAsPng?: boolean;
  metallic?: boolean;
  yawDeg?: number;
}

type Box = { min: [number, number, number]; max: [number, number, number] };

/** 12 tam giác của một hộp, mỗi mặt 4 đỉnh riêng */
function boxGeometry(boxes: Box[], yawDeg: number) {
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const rad = (yawDeg * Math.PI) / 180;
  const [c, s] = [Math.cos(rad), Math.sin(rad)];
  for (const { min, max } of boxes) {
    const at = (x: number, y: number, z: number) => [
      x ? max[0] : min[0],
      y ? max[1] : min[1],
      z ? max[2] : min[2],
    ];
    const faces = [
      [at(0, 0, 0), at(1, 0, 0), at(1, 1, 0), at(0, 1, 0)],
      [at(1, 0, 1), at(0, 0, 1), at(0, 1, 1), at(1, 1, 1)],
      [at(0, 0, 1), at(0, 0, 0), at(0, 1, 0), at(0, 1, 1)],
      [at(1, 0, 0), at(1, 0, 1), at(1, 1, 1), at(1, 1, 0)],
      [at(0, 1, 0), at(1, 1, 0), at(1, 1, 1), at(0, 1, 1)],
      [at(0, 0, 1), at(1, 0, 1), at(1, 0, 0), at(0, 0, 0)],
    ];
    for (const face of faces) {
      const base = position.length / 3;
      for (const [x, y, z] of face) position.push(c * x + s * z, y, -s * x + c * z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return { position, uv, index };
}

/** Một cái bàn đơn giản: mặt bàn + 4 chân; tùy chọn thêm tấm sàn rộng hơn ở đáy */
export async function buildFakeGlb(options: FakeGlbOptions = {}): Promise<Buffer> {
  const [l, h, w] = options.size ?? [1.4, 0.75, 0.65];
  const leg = Math.min(l, w) * 0.08;
  const top = h * 0.12;
  const boxes: Box[] = [{ min: [-l / 2, h - top, -w / 2], max: [l / 2, h, w / 2] }];
  for (const x of [-l / 2, l / 2 - leg])
    for (const z of [-w / 2, w / 2 - leg]) boxes.push({ min: [x, 0, z], max: [x + leg, h - top, z + leg] });
  // tấm sàn: mỏng 2% chiều cao, nằm cách đáy 2% và rộng gấp đôi chiều dài (như lỗi của Hunyuan3D)
  if (options.floor) boxes.push({ min: [-l, h * 0.02, -l], max: [l, h * 0.04, l] });

  const { position, uv, index } = boxGeometry(boxes, options.yawDeg ?? 0);
  const doc = new Document();
  const buffer = doc.createBuffer();
  const accessor = (type: 'VEC3' | 'VEC2' | 'SCALAR', array: Float32Array | Uint32Array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  // ảnh chuyển màu (không một màu) để bước dọn tệp không thay texture bằng màu phẳng
  const side = 64;
  const raw = Buffer.alloc(side * side * 3);
  for (let i = 0; i < side * side; i++)
    raw.set([185, 141 - ((i % side) >> 1), 92 - (Math.floor(i / side) >> 1)], i * 3);
  const pixels = sharp(raw, { raw: { width: side, height: side, channels: 3 } });
  const image = options.jpegAsPng ? await pixels.jpeg().toBuffer() : await pixels.png().toBuffer();
  const texture = doc.createTexture('color').setImage(new Uint8Array(image)).setMimeType('image/png');
  const material = doc
    .createMaterial('wood')
    .setBaseColorTexture(texture)
    .setMetallicFactor(options.metallic ? 1 : 0)
    .setRoughnessFactor(options.metallic ? 1 : 0.8);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(position)))
    .setAttribute('TEXCOORD_0', accessor('VEC2', new Float32Array(uv)))
    .setIndices(accessor('SCALAR', new Uint32Array(index)))
    .setMaterial(material);
  const node = doc.createNode('table').setMesh(doc.createMesh('table').addPrimitive(primitive));
  doc.getRoot().setDefaultScene(doc.createScene('scene').addChild(node));
  const io = await getIO();
  const out = Buffer.from(await io.writeBinary(doc));
  // writeBinary ghi mimeType theo khai báo; nếu muốn "JPEG khai là PNG" thì dữ liệu đã sẵn là JPEG
  return out;
}
