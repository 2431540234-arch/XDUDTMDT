import type { AppConfig } from '../../config/app-config.service';
import type { AiErrorKind } from './ai-errors';
import { FakeProvider } from './fake.provider';
import { HuggingFaceProvider } from './huggingface.provider';
import type { ThreeDProvider } from './three-d-provider';

const OFF: ThreeDProvider = {
  id: 'off',
  unavailableReason: () => 'Tính năng tạo mô hình bằng AI đang tắt (AI3D_PROVIDER=off).',
  spaces: () => [],
  generate: () => Promise.reject(new Error('AI3D_PROVIDER=off')),
};

export function createThreeDProvider(config: AppConfig): ThreeDProvider {
  const kind = config.get('AI3D_PROVIDER');
  if (kind === 'off') return OFF;
  if (kind === 'fake') return new FakeProvider(() => process.env.AI3D_FAKE_ERROR as AiErrorKind | undefined);
  return new HuggingFaceProvider({
    token: config.get('HF_TOKEN'),
    primarySpace: config.get('AI3D_SPACE'),
    fallbackSpace: config.get('AI3D_FALLBACK_SPACE'),
    timeoutMs: config.get('AI3D_TIMEOUT_SECONDS') * 1000,
    maxResultBytes: config.get('UPLOAD_MAX_MODEL_MB') * 1024 * 1024,
  });
}
