import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE, type StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [AppConfig],
      // Chọn driver theo STORAGE_DRIVER. Thêm case 'minio' khi có MinioStorageService.
      useFactory: (config: AppConfig): StorageService => {
        switch (config.get('STORAGE_DRIVER')) {
          case 'local':
          default:
            return new LocalStorageService(config);
        }
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
