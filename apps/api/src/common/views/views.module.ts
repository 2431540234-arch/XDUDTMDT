import { Global, Module } from '@nestjs/common';
import { CatalogViews } from './catalog-views.service';
import { MediaIngestService } from './media-ingest.service';

/** Dựng view dùng chung cho nhiều module (global để khỏi import lặp) */
@Global()
@Module({ providers: [CatalogViews, MediaIngestService], exports: [CatalogViews, MediaIngestService] })
export class ViewsModule {}
