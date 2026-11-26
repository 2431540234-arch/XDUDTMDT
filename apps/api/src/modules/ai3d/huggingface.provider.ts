// Tạo mô hình bằng space Hugging Face qua @gradio/client. Token chỉ nằm trong cấu hình máy chủ: không ghi log,
// không lưu CSDL, không trả ra API (mọi lỗi đi qua maskSecrets).
import { AiProviderError } from './ai-errors';
import { SPACE_ADAPTERS, type SpaceCall } from './spaces';
import type { GenerateInput, GenerateResult, ThreeDProvider, ThreeDSpaceInfo } from './three-d-provider';

export interface HuggingFaceOptions {
  token?: string;
  primarySpace: string;
  fallbackSpace?: string;
  timeoutMs: number;
  maxResultBytes: number;
}

interface GradioEvent {
  type: string;
  stage?: string;
  message?: unknown;
  title?: unknown;
  data?: unknown[];
}
interface GradioApp {
  submit(endpoint: string, payload: unknown): AsyncIterable<GradioEvent> & { cancel?: () => unknown };
  close?: () => void;
}
export interface GradioModule {
  Client: { connect(space: string, options: Record<string, unknown>): Promise<GradioApp> };
  handle_file(file: Buffer): unknown;
}

export class HuggingFaceProvider implements ThreeDProvider {
  readonly id = 'huggingface';

  constructor(
    private readonly options: HuggingFaceOptions,
    // tách ra để test không gọi Hugging Face thật
    private readonly load: () => Promise<GradioModule> = async () =>
      (await import('@gradio/client')) as unknown as GradioModule,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  spaces(): ThreeDSpaceInfo[] {
    const entry = (id: string | undefined, role: 'primary' | 'fallback') =>
      id && SPACE_ADAPTERS[id]
        ? [{ id, role, label: SPACE_ADAPTERS[id].label, note: SPACE_ADAPTERS[id].note }]
        : [];
    const fallback =
      this.options.fallbackSpace === this.options.primarySpace ? undefined : this.options.fallbackSpace;
    return [...entry(this.options.primarySpace, 'primary'), ...entry(fallback, 'fallback')];
  }

  unavailableReason(): string | null {
    if (!this.options.token)
      return 'Máy chủ chưa cấu hình HF_TOKEN (token Hugging Face quyền "read") trong tệp .env.';
    if (!SPACE_ADAPTERS[this.options.primarySpace])
      return `AI3D_SPACE "${this.options.primarySpace}" chưa được hỗ trợ.`;
    return null;
  }

  async generate({ image, space }: GenerateInput): Promise<GenerateResult> {
    const adapter = SPACE_ADAPTERS[space];
    if (this.unavailableReason() || !adapter || !this.spaces().some((s) => s.id === space))
      throw new AiProviderError('unknown', this.unavailableReason() ?? `Space "${space}" không được phép.`);
    const token = this.options.token!;
    const started = Date.now();
    const deadline = started + this.options.timeoutMs;
    let timer: NodeJS.Timeout | undefined;
    let current: { cancel?: () => unknown } | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        void current?.cancel?.();
        reject(new AiProviderError('timeout', `Quá ${this.options.timeoutMs / 1000} giây.`));
      }, this.options.timeoutMs);
    });

    let app: GradioApp | undefined;
    const work = async (): Promise<GenerateResult> => {
      const gradio = await this.load();
      try {
        app = await gradio.Client.connect(space, { token, events: ['status', 'data'] });
      } catch (e) {
        // chưa gọi hàm nào ⇒ chưa tốn lượt GPU
        const error = AiProviderError.from(e, token);
        throw error.kind === 'unknown' ? new AiProviderError('space_unavailable', error.raw) : error;
      }
      const call: SpaceCall = async (endpoint, payload) => {
        const job = app!.submit(endpoint, payload);
        current = job;
        let data: unknown[] | undefined;
        for await (const event of job) {
          if (event.type === 'data') data = event.data;
          if (event.type === 'status' && event.stage === 'error')
            throw AiProviderError.from({ title: event.title, message: event.message }, token);
          if (Date.now() > deadline) throw new AiProviderError('timeout', 'Quá thời gian chờ.');
        }
        if (!data) throw new AiProviderError('unknown', `${endpoint}: không nhận được dữ liệu.`);
        return data;
      };
      const file = await adapter.run(call, gradio.handle_file(image));
      const response = await this.fetchImpl(file.url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new AiProviderError('bad_output', `Tải kết quả lỗi HTTP ${response.status}.`);
      const glb = Buffer.from(await response.arrayBuffer());
      if (
        glb.length < 20 ||
        glb.toString('ascii', 0, 4) !== 'glTF' ||
        glb.length > this.options.maxResultBytes
      )
        throw new AiProviderError('bad_output', `Tệp nhận về không hợp lệ (${glb.length} byte).`);
      return { glb, space, seconds: Math.round((Date.now() - started) / 100) / 10 };
    };

    try {
      return await Promise.race([work(), timeout]);
    } catch (e) {
      throw AiProviderError.from(e, token);
    } finally {
      clearTimeout(timer);
      try {
        app?.close?.();
      } catch {
        /* đóng phiên lỗi không ảnh hưởng kết quả */
      }
    }
  }
}
