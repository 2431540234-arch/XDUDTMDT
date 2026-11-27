// Tạo mô hình 3D bằng AI (khác module `ai` – gợi ý/mô tả tự động – vẫn ngoài phạm vi đồ án).
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { ProductModelsModule } from '../product-models/product-models.module';
import { AI3D_ATTEMPTS, AI3D_QUEUE, AI3D_RETRY_DELAY_MS } from './ai3d.constants';
import { Ai3dController } from './ai3d.controller';
import { Ai3dProcessor } from './ai3d.processor';
import { Ai3dService } from './ai3d.service';
import { createThreeDProvider } from './provider.factory';
import { THREE_D_PROVIDER } from './three-d-provider';

@Module({
  imports: [
    ProductModelsModule,
    BullModule.registerQueue({
      name: AI3D_QUEUE,
      defaultJobOptions: {
        attempts: AI3D_ATTEMPTS,
        backoff: { type: 'fixed', delay: AI3D_RETRY_DELAY_MS },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [Ai3dController],
  providers: [
    Ai3dService,
    Ai3dProcessor,
    { provide: THREE_D_PROVIDER, inject: [AppConfig], useFactory: createThreeDProvider },
  ],
})
export class Ai3dModule {}
