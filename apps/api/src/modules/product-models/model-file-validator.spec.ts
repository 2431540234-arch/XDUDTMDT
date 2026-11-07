// Unit test: kiểm tra tệp mô hình 3D tải lên (đuôi, MIME, dung lượng, chữ ký tệp, tên tệp an toàn).
import { MODEL_MAX_BYTES, safeFileName, validateModelFile } from './model-file-validator';

const glb = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(32)]);
const usdz = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32)]);
const gltf = Buffer.from('{ "asset": { "version": "2.0" } }');

const fails = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect((e as { code: string }).code).toBe(code);
    return;
  }
  throw new Error('Đáng lẽ phải ném lỗi');
};

describe('validateModelFile', () => {
  it('chấp nhận GLB, GLTF, USDZ hợp lệ', () => {
    expect(
      validateModelFile({
        fileName: 'sofa.glb',
        sizeBytes: glb.length,
        bytes: glb,
        mimeType: 'model/gltf-binary',
      }),
    ).toMatchObject({ format: 'glb', ext: 'glb' });
    expect(validateModelFile({ fileName: 'sofa.GLTF', sizeBytes: gltf.length, bytes: gltf })).toMatchObject({
      format: 'glb',
      mime: 'model/gltf+json',
    });
    expect(
      validateModelFile({
        fileName: 'sofa.usdz',
        sizeBytes: usdz.length,
        bytes: usdz,
        declaredFormat: 'usdz',
      }),
    ).toMatchObject({ format: 'usdz' });
  });
  it('từ chối đuôi tệp lạ (415)', () => {
    fails(() => validateModelFile({ fileName: 'virus.exe', sizeBytes: 100 }), 'UNSUPPORTED_MEDIA_TYPE');
    fails(() => validateModelFile({ fileName: 'model.obj', sizeBytes: 100 }), 'UNSUPPORTED_MEDIA_TYPE');
  });
  it('định dạng khai báo phải khớp đuôi tệp', () => {
    fails(
      () => validateModelFile({ fileName: 'sofa.glb', sizeBytes: 100, declaredFormat: 'usdz' }),
      'UNSUPPORTED_MEDIA_TYPE',
    );
  });
  it('MIME ngoài danh sách bị từ chối', () => {
    fails(
      () => validateModelFile({ fileName: 'sofa.glb', sizeBytes: 100, mimeType: 'text/html' }),
      'UNSUPPORTED_MEDIA_TYPE',
    );
  });
  it('giới hạn 100MB (413) và tệp rỗng (400)', () => {
    expect(() => validateModelFile({ fileName: 'a.glb', sizeBytes: MODEL_MAX_BYTES })).not.toThrow();
    fails(
      () => validateModelFile({ fileName: 'a.glb', sizeBytes: MODEL_MAX_BYTES + 1 }),
      'PAYLOAD_TOO_LARGE',
    );
    fails(() => validateModelFile({ fileName: 'a.glb', sizeBytes: 0 }), 'BAD_REQUEST');
  });
  it('kiểm tra chữ ký tệp: đuôi .glb nhưng nội dung không phải glTF bị từ chối', () => {
    fails(
      () =>
        validateModelFile({ fileName: 'fake.glb', sizeBytes: 20, bytes: Buffer.from('<html>fake</html>') }),
      'UNSUPPORTED_MEDIA_TYPE',
    );
    fails(
      () => validateModelFile({ fileName: 'fake.usdz', sizeBytes: 20, bytes: glb }),
      'UNSUPPORTED_MEDIA_TYPE',
    );
    fails(
      () => validateModelFile({ fileName: 'fake.gltf', sizeBytes: 20, bytes: Buffer.from('{"x":1}') }),
      'UNSUPPORTED_MEDIA_TYPE',
    );
  });
});

describe('safeFileName (chống path traversal)', () => {
  it('chỉ giữ phần tên tệp', () => {
    expect(safeFileName('../../etc/passwd.glb')).toBe('passwd.glb');
    expect(safeFileName('C:\\Windows\\evil.glb')).toBe('evil.glb');
    expect(safeFileName('/var/www/sofa.glb')).toBe('sofa.glb');
  });
  it('từ chối tên rỗng, ".." hoặc quá dài', () => {
    expect(safeFileName('')).toBe('');
    expect(safeFileName('..')).toBe('');
    expect(safeFileName('a..b.glb')).toBe('');
    expect(safeFileName(`${'x'.repeat(130)}.glb`)).toBe('');
  });
  it('tên tệp có đường dẫn traversal vẫn qua kiểm tra nhưng đã được làm sạch', () => {
    expect(validateModelFile({ fileName: '../../evil.glb', sizeBytes: 100 }).fileName).toBe('evil.glb');
  });
});
