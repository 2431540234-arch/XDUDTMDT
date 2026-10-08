import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IMAGE_QUEUE, type ImageJobData } from '../jobs.constants';
import { ImageProcessingService, type ImageProcessingResult } from './image-processing.service';

@Processor(IMAGE_QUEUE, { concurrency: 4 })
export class ImageProcessingProcessor extends WorkerHost {
  constructor(private readonly service: ImageProcessingService) {
    super();
  }

  process(job: Job<ImageJobData>): Promise<ImageProcessingResult> {
    return this.service.process(job.data);
  }
}
