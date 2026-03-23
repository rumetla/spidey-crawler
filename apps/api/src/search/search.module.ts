import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { AssignmentSearchController } from './assignment-search.controller';

@Module({
  controllers: [SearchController, AssignmentSearchController],
  providers: [SearchService],
})
export class SearchModule {}
