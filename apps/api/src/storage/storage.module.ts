import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { LocalStorageService } from './local-storage.service';
import { MinioStorageService } from './minio-storage.service';
import { STORAGE_SERVICE, type StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [AppConfig],
      // Chọn driver theo STORAGE_DRIVER (local | minio)
      useFactory: (config: AppConfig): StorageService =>
        config.get('STORAGE_DRIVER') === 'minio'
          ? new MinioStorageService(config)
          : new LocalStorageService(config),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
