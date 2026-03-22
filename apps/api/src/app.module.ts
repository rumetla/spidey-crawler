import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { SSEModule } from './sse/sse.module';
import { CrawlerModule } from './crawler/crawler.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [DatabaseModule, SSEModule, CrawlerModule, SearchModule],
})
export class AppModule {}
