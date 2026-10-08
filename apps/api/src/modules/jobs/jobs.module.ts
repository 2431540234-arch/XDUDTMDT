// Hạ tầng hàng đợi BullMQ + Redis (worker chạy cùng tiến trình API). Xem jobs.constants.ts.
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { bullBoardAdminOnly } from './bull-board.middleware';
import { ImageProcessingProcessor } from './image-processing/image-processing.processor';
import { ImageProcessingService } from './image-processing/image-processing.service';
import { IMAGE_QUEUE, JOB_ATTEMPTS, MODEL_QUEUE } from './jobs.constants';
import { JobsService } from './jobs.service';
import { ModelProcessingProcessor } from './model-processing/model-processing.processor';
import { ModelProcessingService } from './model-processing/model-processing.service';

const defaultJobOptions = {
  attempts: JOB_ATTEMPTS,
  backoff: { type: 'exponential' as const, delay: 2000 }, // 2s, 4s, 8s...
  removeOnComplete: { age: 3600, count: 500 },
  removeOnFail: false, // giữ job thất bại để xem trong Bull Board
};

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          maxRetriesPerRequest: null,
        },
        // Tách khóa của test khỏi dev để e2e không đụng hàng đợi thật
        prefix: config.get('NODE_ENV') === 'test' ? 'bull-test' : 'bull',
      }),
    }),
    BullModule.registerQueue(
      { name: MODEL_QUEUE, defaultJobOptions },
      { name: IMAGE_QUEUE, defaultJobOptions },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
      middleware: bullBoardAdminOnly,
    }),
    BullBoardModule.forFeature(
      { name: MODEL_QUEUE, adapter: BullMQAdapter },
      { name: IMAGE_QUEUE, adapter: BullMQAdapter },
    ),
  ],
  providers: [
    JobsService,
    ModelProcessingService,
    ModelProcessingProcessor,
    ImageProcessingService,
    ImageProcessingProcessor,
  ],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
