// Phân loại lỗi, che token, provider Hugging Face (thư viện giả – KHÔNG gọi mạng), quy tắc thử lại của worker.
import { UnrecoverableError, type Job } from 'bullmq';
import { validateEnv } from '../../config/env.validation';
import { AiProviderError, classifyMessage, maskSecrets } from './ai-errors';
import { Ai3dProcessor } from './ai3d.processor';
import type { Ai3dJobData } from './ai3d.constants';
import { buildFakeGlb } from './fake-glb';
import { HuggingFaceProvider, type GradioModule } from './huggingface.provider';
import { findGlb } from './spaces';

const TOKEN = 'hf_TESTTOKEN1234567890abcdef';

describe('lỗi nhà cung cấp AI', () => {
  it.each([
    ['You have exceeded your free GPU quota (60s requested vs. 12s left)', 'quota'],
    ['401 Unauthorized: invalid token', 'auth'],
    ['The queue is full, queue timed out', 'queue_timeout'],
    ['Space is sleeping', 'space_unavailable'],
    ['Could not resolve app config', 'space_unavailable'],
    ['Connection errored out. ', 'unknown'],
    ['An error occurred', 'unknown'],
  ])('%s ⇒ %s', (message, kind) => {
    expect(classifyMessage(message)).toBe(kind);
  });

  it('chỉ lỗi chắc chắn tạm thời được thử lại; hết lượt và lỗi lạ thì không', () => {
    const retryable = (m: string) => AiProviderError.from(new Error(m)).retryable;
    expect(retryable('Space is sleeping')).toBe(true);
    expect(retryable('exceeded your GPU quota')).toBe(false);
    expect(retryable('An error occurred')).toBe(false);
  });

  it('che token, Bearer và chữ ký trong URL', () => {
    const text = `lỗi ${TOKEN} Bearer abcdefgh12345 https://x.hf.space/f?__sign=SECRET123&a=1`;
    const masked = maskSecrets(text, TOKEN);
    for (const secret of [TOKEN, 'abcdefgh12345', 'SECRET123']) expect(masked).not.toContain(secret);
    expect(AiProviderError.from({ title: 'Lỗi', message: `bad ${TOKEN}` }, TOKEN).raw).not.toContain(TOKEN);
  });
});

type Step = { type: string; stage?: string; message?: string; data?: unknown[] };

/** @gradio/client giả: mỗi endpoint trả một chuỗi sự kiện định sẵn */
function fakeGradio(script: Record<string, Step[] | 'hang'>, calls: string[], connectError?: Error) {
  const gradio: GradioModule = {
    handle_file: (f) => f,
    Client: {
      connect: async () => {
        if (connectError) throw connectError;
        return {
          submit: (endpoint: string) => {
            calls.push(endpoint);
            const steps = script[endpoint];
            return (async function* () {
              if (steps === 'hang') await new Promise(() => undefined);
              else yield* steps ?? [];
            })();
          },
        };
      },
    },
  };
  return async () => gradio;
}
const ok = (data: unknown[] = []): Step[] => [{ type: 'data', data }];
const glbFile = (name: string) => ({ url: `https://space.test/${name}`, orig_name: name });

const provider = (load: () => Promise<GradioModule>, over: { token?: string; timeoutMs?: number } = {}) => {
  const fetched: string[] = [];
  const fetchFake = (async (url: string) => {
    fetched.push(url);
    return new Response(new Uint8Array(await buildFakeGlb()));
  }) as unknown as typeof fetch;
  const p = new HuggingFaceProvider(
    {
      token: 'token' in over ? over.token : TOKEN,
      primarySpace: 'trellis-community/TRELLIS',
      fallbackSpace: 'tencent/Hunyuan3D-2.1',
      timeoutMs: over.timeoutMs ?? 5000,
      maxResultBytes: 50 * 1024 * 1024,
    },
    load,
    fetchFake,
  );
  return { p, fetched };
};
const image = Buffer.from('png');

describe('HuggingFaceProvider (không gọi mạng)', () => {
  it('thiếu HF_TOKEN ⇒ tắt kèm lý do, không gọi space', async () => {
    const calls: string[] = [];
    const { p } = provider(fakeGradio({}, calls), { token: undefined });
    expect(p.unavailableReason()).toContain('HF_TOKEN');
    await expect(p.generate({ image, space: 'trellis-community/TRELLIS' })).rejects.toBeInstanceOf(
      AiProviderError,
    );
    expect(calls).toEqual([]);
  });

  it('TRELLIS: mở phiên rồi tạo; tải đúng tệp GLB', async () => {
    const calls: string[] = [];
    const { p, fetched } = provider(
      fakeGradio(
        {
          '/start_session': ok(),
          '/generate_and_extract_glb': ok([{ video: glbFile('a.mp4') }, glbFile('sample.glb')]),
        },
        calls,
      ),
    );
    const r = await p.generate({ image, space: 'trellis-community/TRELLIS' });
    expect(calls).toEqual(['/start_session', '/generate_and_extract_glb']);
    expect(fetched).toEqual(['https://space.test/sample.glb']);
    expect(r.glb.toString('ascii', 0, 4)).toBe('glTF');
  });

  it('Hunyuan: một lần gọi, chọn bản có texture', () => {
    const data = [
      { url: 'u1', orig_name: 'white_mesh.glb' },
      { url: 'u2', orig_name: 'textured_mesh.glb' },
    ];
    expect(findGlb(data, /textured/i)?.url).toBe('u2');
  });

  it('lỗi từ space: phân loại đúng và không lộ token; dừng ngay, không gọi tiếp', async () => {
    const calls: string[] = [];
    const { p } = provider(
      fakeGradio(
        {
          '/start_session': [{ type: 'status', stage: 'error', message: `GPU quota exceeded ${TOKEN}` }],
        },
        calls,
      ),
    );
    const error = (await p
      .generate({ image, space: 'trellis-community/TRELLIS' })
      .catch((e) => e)) as AiProviderError;
    expect(error.kind).toBe('quota');
    expect(error.raw).not.toContain(TOKEN);
    expect(calls).toEqual(['/start_session']);
  });

  it('không kết nối được (chưa tốn GPU) ⇒ space_unavailable; quá giờ ⇒ timeout, không thử lại', async () => {
    const down = provider(fakeGradio({}, [], new Error('boom')));
    await expect(down.p.generate({ image, space: 'trellis-community/TRELLIS' })).rejects.toMatchObject({
      kind: 'space_unavailable',
    });
    const slow = provider(fakeGradio({ '/start_session': 'hang' }, []), { timeoutMs: 50 });
    await expect(slow.p.generate({ image, space: 'trellis-community/TRELLIS' })).rejects.toMatchObject({
      kind: 'timeout',
      retryable: false,
    });
  });
});

describe('Ai3dProcessor (thử lại)', () => {
  const job = (attemptsMade: number) =>
    ({
      data: { modelId: 7, adminId: 1 },
      attemptsMade,
      opts: { attempts: 2 },
    }) as unknown as Job<Ai3dJobData>;
  const setup = (error: Error) => {
    const service = { runGeneration: jest.fn().mockRejectedValue(error), fail: jest.fn() };
    return { service, processor: new Ai3dProcessor(service as never) };
  };

  it('lỗi tạm thời: thử lại đúng 1 lần rồi mới đánh dấu lỗi', async () => {
    const { service, processor } = setup(new AiProviderError('space_unavailable', 'x'));
    await expect(processor.process(job(0))).rejects.toBeInstanceOf(AiProviderError);
    expect(service.fail).not.toHaveBeenCalled();
    await expect(processor.process(job(1))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(service.fail).toHaveBeenCalledTimes(1);
  });

  it.each(['quota', 'unknown', 'timeout', 'auth'] as const)('%s: không thử lại', async (kind) => {
    const { service, processor } = setup(new AiProviderError(kind, 'x'));
    await expect(processor.process(job(0))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(service.fail).toHaveBeenCalledTimes(1);
  });

  it('job bị treo (khởi động lại giữa chừng) ⇒ đánh dấu gián đoạn, không chạy lại', async () => {
    const { service, processor } = setup(new Error('x'));
    await processor.onFailed(job(0), new Error('job stalled more than allowable limit'));
    expect(service.fail.mock.calls[0][1]).toMatchObject({ kind: 'interrupted' });
  });
});

describe('cấu hình AI3D', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    STORAGE_DRIVER: 'local',
  };
  it('mặc định: TRELLIS, 3 lượt/giờ, 10 lượt/ngày, không bắt buộc token', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      AI3D_PROVIDER: 'huggingface',
      AI3D_SPACE: 'trellis-community/TRELLIS',
      AI3D_MAX_JOBS_PER_HOUR: 3,
      AI3D_MAX_JOBS_PER_DAY: 10,
    });
    expect(env.HF_TOKEN).toBeUndefined();
  });
  it('production cấm nhà cung cấp giả lập', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', AI3D_PROVIDER: 'fake' })).toThrow(
      /AI3D_PROVIDER/,
    );
  });
});
