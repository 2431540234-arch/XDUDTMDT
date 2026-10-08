// Sinh tệp mẫu cho test: node test/fixtures/generate-fixtures.mjs
// Các tệp do dự án TỰ TẠO (không lấy từ bên thứ ba), phát hành CC0 1.0 (public domain).
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';

const dir = dirname(fileURLToPath(import.meta.url));

// Quả cầu UV 32x24: ~1.500 tam giác, đủ để thấy LOD giảm đa giác
const SEG_U = 32;
const SEG_V = 24;
const positions = [];
const normals = [];
const uvs = [];
const indices = [];
for (let v = 0; v <= SEG_V; v++) {
  for (let u = 0; u <= SEG_U; u++) {
    const theta = (u / SEG_U) * Math.PI * 2;
    const phi = (v / SEG_V) * Math.PI;
    const x = Math.cos(theta) * Math.sin(phi);
    const y = Math.cos(phi);
    const z = Math.sin(theta) * Math.sin(phi);
    positions.push(x * 0.5, y * 0.5, z * 0.5);
    normals.push(x, y, z);
    uvs.push(u / SEG_U, v / SEG_V);
  }
}
for (let v = 0; v < SEG_V; v++) {
  for (let u = 0; u < SEG_U; u++) {
    const a = v * (SEG_U + 1) + u;
    const b = a + SEG_U + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
}

// Texture 1024x1024 dạng gradient để kiểm tra việc thu nhỏ texture theo LOD
const texture = await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: { r: 200, g: 120, b: 60 } },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="1024" height="1024"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#238"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>',
      ),
    },
  ])
  .png()
  .toBuffer();

const doc = new Document();
const buffer = doc.createBuffer();
const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const tex = doc.createTexture('base').setImage(texture).setMimeType('image/png');
const material = doc.createMaterial('mat').setBaseColorTexture(tex);
const prim = doc
  .createPrimitive()
  .setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
  .setAttribute('NORMAL', accessor('VEC3', new Float32Array(normals)))
  .setAttribute('TEXCOORD_0', accessor('VEC2', new Float32Array(uvs)))
  .setIndices(accessor('SCALAR', new Uint32Array(indices)))
  .setMaterial(material);
const mesh = doc.createMesh('sphere').addPrimitive(prim);
const node = doc.createNode('sphere').setMesh(mesh);
doc.createScene('main').addChild(node);

const glb = Buffer.from(await new NodeIO().writeBinary(doc));
writeFileSync(resolve(dir, 'sphere.glb'), glb);
// GLB hỏng: đúng chữ ký nhưng cắt cụt nội dung
writeFileSync(resolve(dir, 'broken.glb'), glb.subarray(0, 200));
console.log(`sphere.glb ${glb.length} byte, ${indices.length / 3} tam giác; broken.glb 200 byte`);
