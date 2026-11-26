// Chuẩn hóa mô hình (hàm thuần): dùng GLB sinh trong bộ nhớ, tái hiện đúng các lỗi gặp ở mô hình AI thật.
import { getBounds, type Document } from '@gltf-transform/core';
import { buildFakeGlb } from '../../ai3d/fake-glb';
import { buildLod, readGlb } from './glb-tools';
import { detectFloor, normalizeModel, sniffImageMime } from './normalize';

const target = { length: 1400, width: 650, height: 750 };
const boundsOf = (doc: Document) => getBounds(doc.getRoot().listScenes()[0]);
const near = (a: number, b: number, tolerance = 0.01) => expect(Math.abs(a - b)).toBeLessThan(tolerance);

describe('normalizeModel', () => {
  it('co theo kích thước thật (mét), đáy ở Y = 0, căn giữa X/Z, cạnh dài trên trục X', async () => {
    const source = await buildFakeGlb({ size: [2.8, 1.5, 1.3] });
    const { buffer, report } = await normalizeModel(source, { target, source: 'upload' });
    const { min, max } = boundsOf(await readGlb(buffer));
    near(max[0] - min[0], 1.4);
    near(max[1] - min[1], 0.75);
    near(max[2] - min[2], 0.65);
    near(min[1], 0, 0.001);
    near(min[0] + max[0], 0, 0.001);
    near(min[2] + max[2], 0, 0.001);
    expect(report.measuredMm).toEqual(target);
    expect(report.distorted).toBe(false);
    expect(report.warnings).toEqual([]);
  });

  it.each([30, 90, 135])('mô hình bị xoay %i° được xoay thẳng lại', async (yawDeg) => {
    const source = await buildFakeGlb({ yawDeg });
    const { report } = await normalizeModel(source, { target, source: 'upload' });
    near(report.measuredMm.length, 1400, 15);
    near(report.measuredMm.width, 650, 15);
    expect(report.distorted).toBe(false);
  });

  it('góc admin xoay thêm 90° đổi chỗ dài và rộng', async () => {
    const source = await buildFakeGlb();
    const { report } = await normalizeModel(source, { target, source: 'upload', yawDeg: 90 });
    expect(report.manualYawDeg).toBe(90);
    expect(report.measuredMm.width).toBeGreaterThan(report.measuredMm.length);
  });

  it('co ĐỀU (giữ hình) và cảnh báo khi một chiều lệch hơn 15%', async () => {
    const source = await buildFakeGlb({ size: [1, 1, 1] });
    const { report } = await normalizeModel(source, { target, source: 'upload' });
    expect(report.distorted).toBe(true);
    expect(report.warnings.join(' ')).toContain('lệch hơn 15%');
    near(report.measuredMm.length, report.measuredMm.height, 2);
  });

  it('phát hiện tấm sàn thừa; gỡ xong đúng tỉ lệ và chân bàn không bị cụt', async () => {
    const source = await buildFakeGlb({ floor: true });
    const floor = await detectFloor(source);
    expect(floor).not.toBeNull();
    expect(floor!.footprintRatio).toBeGreaterThan(1.5);
    const cleaned = await normalizeModel(source, { target, source: 'ai' }, floor);
    expect(cleaned.report.floorRemoved).toBe(true);
    expect(cleaned.report.floorTriangles).toBeGreaterThan(0);
    expect(cleaned.report.distorted).toBe(false);
    const { min, max } = boundsOf(await readGlb(cleaned.buffer));
    near(max[1] - min[1], 0.75, 0.03);
    near(min[1], 0, 0.001);

    const original = await normalizeModel(source, { target, source: 'ai' }, null);
    expect(original.report.floorRemoved).toBe(false);
    expect(original.report.distorted).toBe(true);
  });

  it('không nhận nhầm sàn: bàn bình thường, và vật phẳng như tấm thảm', async () => {
    expect(await detectFloor(await buildFakeGlb())).toBeNull();
    expect(await detectFloor(await buildFakeGlb({ size: [2, 0.001, 1.5] }))).toBeNull();
  });

  it('ảnh JPEG khai là PNG được sửa kiểu theo nội dung thật rồi sinh được LOD', async () => {
    const source = await buildFakeGlb({ jpegAsPng: true });
    const mimeOf = async (b: Buffer) => (await readGlb(b)).getRoot().listTextures()[0].getMimeType();
    expect(await mimeOf(source)).toBe('image/png'); // khai sai như tệp của Hunyuan3D
    const { buffer, report } = await normalizeModel(source, { target, source: 'ai' });
    expect(report.fixes.textureMime).toBe(1);
    expect(await mimeOf(buffer)).toBe('image/jpeg');
    await expect(buildLod(buffer, 'high')).resolves.toMatchObject({ lod: 'high' });
  });

  it('vật liệu kim loại không có map được đặt lại; tệp tải lên có thông số hợp lệ thì giữ nguyên', async () => {
    const metal = await normalizeModel(await buildFakeGlb({ metallic: true }), { target, source: 'ai' });
    const material = (await readGlb(metal.buffer)).getRoot().listMaterials()[0];
    expect(material.getMetallicFactor()).toBe(0);
    near(material.getRoughnessFactor(), 0.8);
    const kept = await normalizeModel(await buildFakeGlb(), { target, source: 'upload' });
    expect(kept.report.fixes.materials).toBe(0);
  });

  it('nhận kiểu ảnh theo chữ ký tệp', () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(sniffImageMime(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
