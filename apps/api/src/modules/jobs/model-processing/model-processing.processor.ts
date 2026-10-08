// Processor mỏng: chỉ nối BullMQ với ModelProcessingService.
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { JOB_ATTEMPTS, MODEL_QUEUE, type ModelJobData } from '../jobs.constants';
import {
  InvalidModelFileError,
  ModelProcessingService,
  type ModelProcessingResult,
} from './model-processing.service';

@Processor(MODEL_QUEUE, { concurrency: 2 })
export class ModelProcessingProcessor extends WorkerHost {
  constructor(private readonly service: ModelProcessingService) {
    super();
  }

  async process(job: Job<ModelJobData>): Promise<ModelProcessingResult> {
    try {
      return await this.service.process(job.data);
    } catch (e) {
      // Tệp hỏng thì retry vô ích: báo lỗi không thể phục hồi để BullMQ không thử lại
      if (e instanceof InvalidModelFileError) throw new UnrecoverableError(e.message);
      throw e;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ModelJobData> | undefined, err: Error) {
    if (!job) return;
    const finalFailure =
      err instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? JOB_ATTEMPTS);
    if (finalFailure) await this.service.markFailed(job.data.modelId, err.message);
  }
}
