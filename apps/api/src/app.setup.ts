// Cấu hình dùng chung cho app thật (main.ts) và app trong test e2e.
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { requestId } from './common/middleware/request-id.middleware';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { AppConfig } from './config/app-config.service';

export function setupApp(app: INestApplication) {
  const config = app.get(AppConfig);

  // /health nằm ngoài prefix để load balancer/docker healthcheck gọi gọn
  app.setGlobalPrefix('api', { exclude: ['health', 'admin/queues', 'admin/queues/(.*)'] });
  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Giới hạn rộng hơn mặc định: FE gửi ảnh dạng data-URL base64 trong body (ảnh ≤ 5MB, frame 360 ≤ 2MB)
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED')) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Aurelia Living API')
        .setDescription('Quy ước response/lỗi: docs/API_CONVENTIONS.md')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }
}
