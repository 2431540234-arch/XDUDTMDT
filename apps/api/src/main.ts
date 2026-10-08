import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';

async function bootstrap() {
  // Import động: AppModule validate env khi nạp; lỗi cấu hình được bắt và in rõ ràng bên dưới.
  const { AppModule } = await import('./app.module');
  const { setupApp } = await import('./app.setup');
  const { AppConfig } = await import('./config/app-config.service');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupApp(app);
  const config = app.get(AppConfig);
  // Driver local: phục vụ tệp đã upload tại /uploads (driver khác dùng URL của chính nó)
  if (config.get('STORAGE_DRIVER') === 'local') {
    app.useStaticAssets(resolve(config.get('STORAGE_LOCAL_DIR')), { prefix: '/uploads' });
  }
  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API chạy tại http://localhost:${port} (Swagger: /docs)`, 'Bootstrap');
}

bootstrap().catch((err: Error) => {
  console.error(`\n[KHỞI ĐỘNG THẤT BẠI] ${err.message}\n`);
  process.exit(1);
});
