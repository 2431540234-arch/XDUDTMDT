// Cấu hình dùng chung cho app thật (main.ts) và app trong test e2e.
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { AppConfig } from './config/app-config.service';

export function setupApp(app: INestApplication) {
  const config = app.get(AppConfig);

  // /health nằm ngoài prefix để load balancer/docker healthcheck gọi gọn
  app.setGlobalPrefix('api', { exclude: ['health', 'admin/queues', 'admin/queues/(.*)'] });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
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
    SwaggerModule.setup('docs', app, doc);
  }
}
