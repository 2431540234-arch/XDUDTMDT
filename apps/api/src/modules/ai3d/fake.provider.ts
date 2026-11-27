// Nhà cung cấp GIẢ LẬP cho test tự động và thử giao diện: không gọi mạng, không cần token. Bị cấm ở production.
// AI3D_FAKE_ERROR=<loại lỗi> để thử nhánh lỗi.
import { AiProviderError, type AiErrorKind } from './ai-errors';
import { buildFakeGlb } from './fake-glb';
import type { GenerateInput, GenerateResult, ThreeDProvider, ThreeDSpaceInfo } from './three-d-provider';

export class FakeProvider implements ThreeDProvider {
  readonly id = 'fake';
  /** số lần generate đã được gọi (cho test) */
  calls = 0;

  constructor(private readonly failWith?: () => AiErrorKind | undefined) {}

  unavailableReason(): string | null {
    return null;
  }

  spaces(): ThreeDSpaceInfo[] {
    return [
      { id: 'fake/space', label: 'Giả lập (không gọi AI)', role: 'primary', note: 'Chỉ dùng khi test.' },
    ];
  }

  async generate({ space }: GenerateInput): Promise<GenerateResult> {
    this.calls++;
    const kind = this.failWith?.();
    if (kind) throw new AiProviderError(kind, `lỗi giả lập: ${kind}`);
    return { glb: await buildFakeGlb({ floor: true, metallic: true }), space, seconds: 0.1 };
  }
}
