import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('api/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * GET /api/search?q=keyword&limit=20
   * Returns: Array of (relevant_url, origin_url, depth) triples with scores.
   */
  @Get()
  query(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    const results = this.search.search(q ?? '', limit ? parseInt(limit, 10) : 20);
    return { query: q, count: results.length, results };
  }
}
