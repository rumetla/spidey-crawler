import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SearchResultDto } from '../common/interfaces';

@Injectable()
export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Live search against the inverted index.
   * Works while the crawler is still running (SQLite WAL mode).
   * Ranking: (title_count * 5) + body_count - (depth * 0.5)
   */
  search(query: string, limit = 20): SearchResultDto[] {
    const rows = this.db.search(query, limit);

    return rows.map((row) => ({
      relevantUrl: row.relevant_url,
      originUrl: row.origin_url,
      depth: row.depth,
      score: row.score,
      title: row.title ?? '',
    }));
  }

  searchByRelevance(query: string, limit = 20) {
    return this.db.searchByRelevance(query, limit);
  }
}
