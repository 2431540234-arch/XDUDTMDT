// Cửa vào duy nhất để module nghiệp vụ đẩy job (không import BullMQ trực tiếp ở nơi khác).
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IMAGE_QUEUE, MODEL_QUEUE, type ImageJobData, type ModelJobData } from './jobs.constants';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(MODEL_QUEUE) private readonly modelQueue: Queue<ModelJobData>,
    @InjectQueue(IMAGE_QUEUE) private readonly imageQueue: Queue<ImageJobData>,
  ) {}

  async enqueueModel(data: ModelJobData): Promise<string> {
    // jobId không được chứa ":" nên dùng "-"
    const job = await this.modelQueue.add('process', data, {
      jobId: `model-${data.modelId}-${data.format}-${data.lod}-${Date.now()}`,
    });
    return job.id as string;
  }

  async enqueueImage(data: ImageJobData): Promise<string> {
    const job = await this.imageQueue.add('process', data, { jobId: `image-${data.mediaId}-${Date.now()}` });
    return job.id as string;
  }

  /** Dùng cho /health: ném lỗi nếu không ping được Redis. */
  async pingRedis(): Promise<void> {
    const client = await this.modelQueue.client;
    const pong = await (client as unknown as { ping(): Promise<string> }).ping();
    if (pong !== 'PONG') throw new Error('Redis không phản hồi PONG');
  }
}
