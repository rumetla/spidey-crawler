import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class AssignmentSearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * GET /search?query=keyword&sortBy=relevance
   * Assignment-compliant endpoint.
   */
  @Get()
  query(
    @Query('query') query: string,
    @Query('sortBy') _sortBy?: string,
    @Query('limit') limit?: string,
  ) {
    const results = this.search.searchByRelevance(
      query ?? '',
      limit ? parseInt(limit, 10) : 20,
    );
    return { query, count: results.length, results };
  }
}
