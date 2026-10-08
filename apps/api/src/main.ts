import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // Import động: AppModule validate env khi nạp; lỗi cấu hình được bắt và in rõ ràng bên dưới.
  const { AppModule } = await import('./app.module');
  const { setupApp } = await import('./app.setup');
  const { AppConfig } = await import('./config/app-config.service');
  const { STORAGE_SERVICE } = await import('./storage/storage.service');
  const { LocalStorageService } = await import('./storage/local-storage.service');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupApp(app);
  // Driver local: phục vụ thư mục public tại /uploads (driver minio dùng URL của MinIO)
  const storage = app.get(STORAGE_SERVICE);
  if (storage instanceof LocalStorageService) {
    app.useStaticAssets(storage.publicRoot, { prefix: '/uploads' });
  }
  const port = app.get(AppConfig).get('PORT');
  await app.listen(port);
  Logger.log(`API chạy tại http://localhost:${port} (Swagger: /docs)`, 'Bootstrap');
}

bootstrap().catch((err: Error) => {
  console.error(`\n[KHỞI ĐỘNG THẤT BẠI] ${err.message}\n`);
  process.exit(1);
});
