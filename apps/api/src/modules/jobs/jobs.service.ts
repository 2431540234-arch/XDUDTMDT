// Cửa vào duy nhất để module nghiệp vụ đẩy job (không import BullMQ trực tiếp ở nơi khác).
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  ALL_QUEUES,
  IMAGE_QUEUE,
  MAIL_QUEUE,
  MODEL_QUEUE,
  NOTIFICATION_QUEUE,
  type ImageJobData,
  type MailJobData,
  type ModelJobData,
  type NotificationJobData,
} from './jobs.constants';

export interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(MODEL_QUEUE) private readonly modelQueue: Queue<ModelJobData>,
    @InjectQueue(IMAGE_QUEUE) private readonly imageQueue: Queue<ImageJobData>,
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue<MailJobData>,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue<NotificationJobData>,
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

  async enqueueMail(data: MailJobData): Promise<string> {
    const job = await this.mailQueue.add('send', data);
    return job.id as string;
  }

  async enqueueNotification(data: NotificationJobData): Promise<string> {
    const job = await this.notificationQueue.add('create', data);
    return job.id as string;
  }

  /** Số job theo trạng thái của từng queue (dùng cho /health). */
  async queueCounts(): Promise<Record<string, QueueCounts>> {
    const queues: Record<string, Queue> = {
      [MODEL_QUEUE]: this.modelQueue,
      [IMAGE_QUEUE]: this.imageQueue,
      [MAIL_QUEUE]: this.mailQueue,
      [NOTIFICATION_QUEUE]: this.notificationQueue,
    };
    const out: Record<string, QueueCounts> = {};
    for (const name of ALL_QUEUES) {
      const c = await queues[name].getJobCounts('waiting', 'active', 'delayed', 'failed');
      out[name] = {
        waiting: c.waiting ?? 0,
        active: c.active ?? 0,
        delayed: c.delayed ?? 0,
        failed: c.failed ?? 0,
      };
    }
    return out;
  }

  /** Dùng cho /health: ném lỗi nếu không ping được Redis. */
  async pingRedis(): Promise<void> {
    const client = await this.modelQueue.client;
    const pong = await (client as unknown as { ping(): Promise<string> }).ping();
    if (pong !== 'PONG') throw new Error('Redis không phản hồi PONG');
  }
}
