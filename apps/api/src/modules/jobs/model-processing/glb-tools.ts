// Xử lý GLB bằng glTF-Transform: đọc, thống kê, sinh LOD. Hàm thuần, không phụ thuộc Nest/Prisma.
import { Document, ImageUtils, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import * as draco3d from 'draco3dgltf';
import sharp from 'sharp';
import type { LodName } from '../jobs.constants';

export interface GlbStats {
  polygonCount: number;
  textureResolution: number | null;
}

export interface LodOutput extends GlbStats {
  lod: LodName;
  buffer: Buffer;
  compressed: boolean;
}

/** Tỉ lệ giữ lại số đa giác và kích thước texture tối đa cho từng LOD. */
const LOD_PLAN: Record<LodName, { ratio: number; maxTexture: number }> = {
  high: { ratio: 1, maxTexture: 2048 },
  medium: { ratio: 0.5, maxTexture: 1024 },
  low: { ratio: 0.15, maxTexture: 512 },
};

const quiet = new Logger(Logger.Verbosity.WARN); // bỏ log info của từng bước transform
let ioPromise: Promise<NodeIO> | undefined;

/** NodeIO có đủ extension + bộ giải nén Draco/Meshopt (đọc được GLB đã nén) và bộ nén Meshopt. */
export function getIO(): Promise<NodeIO> {
  ioPromise ??= (async () => {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
    return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
  })();
  return ioPromise;
}

/** Ném lỗi nếu không phải GLB hợp lệ (magic "glTF", version 2, có ít nhất một mesh). */
export async function readGlb(buffer: Buffer): Promise<Document> {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('Tệp không phải GLB (thiếu chữ ký "glTF").');
  }
  if (buffer.readUInt32LE(4) !== 2) throw new Error('Chỉ hỗ trợ glTF 2.0.');
  const io = await getIO();
  let doc: Document;
  try {
    doc = await io.readBinary(new Uint8Array(buffer));
  } catch (e) {
    throw new Error(`GLB hỏng hoặc không đọc được: ${(e as Error).message}`);
  }
  doc.setLogger(quiet);
  if (doc.getRoot().listMeshes().length === 0) throw new Error('GLB không chứa mesh nào.');
  return doc;
}

export function measure(doc: Document): GlbStats {
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue; // chỉ TRIANGLES
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      triangles += indices ? indices.getCount() / 3 : position ? position.getCount() / 3 : 0;
    }
  }
  let maxTexture = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage();
    const mime = tex.getMimeType();
    if (!image || !mime) continue;
    const size = ImageUtils.getSize(image, mime);
    if (size) maxTexture = Math.max(maxTexture, size[0], size[1]);
  }
  return { polygonCount: Math.round(triangles), textureResolution: maxTexture || null };
}

/** Sinh một LOD từ bản gốc: dọn, giảm đa giác, thu nhỏ texture, nén Meshopt. */
export async function buildLod(source: Buffer, lod: LodName): Promise<LodOutput> {
  const io = await getIO();
  const doc = await readGlb(source); // đọc lại để mỗi LOD có Document riêng
  const plan = LOD_PLAN[lod];

  await doc.transform(dedup(), prune());
  if (plan.ratio < 1) {
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: plan.ratio, error: 0.01 }),
      prune(),
    );
  }
  if (doc.getRoot().listTextures().length > 0) {
    await doc.transform(
      textureCompress({ encoder: sharp, resize: [plan.maxTexture, plan.maxTexture], pattern: /.*/ }),
    );
  }

  const stats = measure(doc);
  let compressed = false;
  try {
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    compressed = true;
  } catch {
    // Nén Meshopt không áp dụng được (ví dụ mesh không hợp lệ cho encoder): giữ bản chưa nén
  }
  const out = await io.writeBinary(doc);
  return { lod, buffer: Buffer.from(out), compressed, ...stats };
}
