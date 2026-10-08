import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import * as presigner from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../config/app-config.service';
import { MinioStorageService } from './minio-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

const values: Record<string, unknown> = {
  STORAGE_PUBLIC_URL: 'http://localhost:9000/aurelia-public/',
  PRESIGN_EXPIRES_SECONDS: 600,
  S3_BUCKET_PUBLIC: 'pub',
  S3_BUCKET_PRIVATE: 'priv',
};
const config = { get: (k: string) => values[k] } as unknown as AppConfig;

function setup() {
  const send = jest.fn();
  const client = { send } as unknown as S3Client;
  const signer = {} as unknown as S3Client;
  return { send, signer, service: new MinioStorageService(config, client, signer) };
}

describe('MinioStorageService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upload ghi vào đúng bucket theo visibility và trả về key (không phải URL)', async () => {
    const { service, send } = setup();
    send.mockResolvedValue({});
    const key = await service.upload({
      key: 'a/b.webp',
      body: Buffer.from('x'),
      contentType: 'image/webp',
      visibility: 'private',
    });
    expect(key).toBe('a/b.webp');
    const cmd = send.mock.calls[0][0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: 'priv', Key: 'a/b.webp', ContentType: 'image/webp' });
  });

  it('getUrl ghép STORAGE_PUBLIC_URL với key, không lặp dấu /', () => {
    const { service } = setup();
    expect(service.getUrl('/images/x.jpg')).toBe('http://localhost:9000/aurelia-public/images/x.jpg');
  });

  it('head trả null khi không tồn tại, trả size khi có', async () => {
    const { service, send } = setup();
    send.mockRejectedValueOnce(
      Object.assign(new Error('nf'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }),
    );
    await expect(service.head('missing')).resolves.toBeNull();
    send.mockResolvedValueOnce({ ContentLength: 12, ContentType: 'model/gltf-binary' });
    await expect(service.head('ok', 'private')).resolves.toEqual({
      size: 12,
      contentType: 'model/gltf-binary',
    });
    expect((send.mock.calls[1][0] as HeadObjectCommand).input.Bucket).toBe('priv');
  });

  it('head ném lại lỗi không phải 404', async () => {
    const { service, send } = setup();
    send.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { name: 'InternalError', $metadata: { httpStatusCode: 500 } }),
    );
    await expect(service.head('x')).rejects.toThrow('boom');
  });

  it('presignPut ký content-type và content-length bằng client dành cho trình duyệt', async () => {
    const { service, signer } = setup();
    (presigner.getSignedUrl as jest.Mock).mockResolvedValue(
      'http://localhost:9000/priv/k?X-Amz-Signature=abc',
    );
    const res = await service.presignPut({
      key: 'k',
      contentType: 'model/gltf-binary',
      size: 1234,
      visibility: 'private',
    });
    const [usedClient, cmd, opts] = (presigner.getSignedUrl as jest.Mock).mock.calls[0];
    expect(usedClient).toBe(signer);
    expect((cmd as PutObjectCommand).input).toMatchObject({
      Bucket: 'priv',
      Key: 'k',
      ContentType: 'model/gltf-binary',
      ContentLength: 1234,
    });
    expect(opts.expiresIn).toBe(600);
    expect([...opts.signableHeaders]).toEqual(expect.arrayContaining(['content-type', 'content-length']));
    expect(res).toMatchObject({
      method: 'PUT',
      key: 'k',
      expiresIn: 600,
      headers: { 'Content-Type': 'model/gltf-binary' },
    });
  });

  it('presignGet mặc định dùng bucket private', async () => {
    const { service } = setup();
    (presigner.getSignedUrl as jest.Mock).mockResolvedValue('http://signed');
    await expect(service.presignGet('k')).resolves.toBe('http://signed');
    expect(((presigner.getSignedUrl as jest.Mock).mock.calls[0][1] as GetObjectCommand).input.Bucket).toBe(
      'priv',
    );
  });
});
