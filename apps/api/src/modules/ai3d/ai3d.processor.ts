// Worker tạo mô hình bằng AI: MỘT job một lúc; không tự chạy lại job bị gián đoạn (tránh tốn thêm lượt GPU).
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { AiProviderError } from './ai-errors';
import { AI3D_ATTEMPTS, AI3D_QUEUE, type Ai3dJobData } from './ai3d.constants';
import { Ai3dService } from './ai3d.service';

@Processor(AI3D_QUEUE, {
  concurrency: 1,
  maxStalledCount: 0,
  // một lần tạo có thể mất vài phút
  lockDuration: 15 * 60_000,
})
export class Ai3dProcessor extends WorkerHost {
  constructor(private readonly service: Ai3dService) {
    super();
  }

  async process(job: Job<Ai3dJobData>): Promise<void> {
    try {
      await this.service.runGeneration(job.data);
    } catch (e) {
      const error = AiProviderError.from(e);
      if (error.retryable && job.attemptsMade + 1 < (job.opts.attempts ?? AI3D_ATTEMPTS)) throw error;
      await this.service.fail(job.data.modelId, error);
      throw new UnrecoverableError(error.message);
    }
  }

  /** Job bị coi là treo (tiến trình khởi động lại giữa chừng): đánh dấu lỗi để admin biết */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<Ai3dJobData> | undefined, err: Error) {
    if (job && /stalled/i.test(err.message))
      await this.service.fail(job.data.modelId, new AiProviderError('interrupted', err.message));
  }
}
