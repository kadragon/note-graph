// Trace: SPEC-search-1, TASK-011
import type { D1Database } from '@cloudflare/workers-types';
import type { SearchFilters, SearchResultItem } from '@shared/types/search';
import type { WorkNote } from '@shared/types/work-note';
import type { Env } from '../types/env';
import { EmbeddingService, VectorizeService } from './embedding-service';
import { FtsSearchService } from './fts-search-service';

/**
 * Hybrid search service combining FTS (lexical) and Vectorize (semantic)
 * Uses Reciprocal Rank Fusion (RRF) to merge results
 */
export class HybridSearchService {
  private ftsService: FtsSearchService;
  private vectorizeService: VectorizeService;

  constructor(
    private db: D1Database,
    env: Env
  ) {
    this.ftsService = new FtsSearchService(db);
    const embeddingService = new EmbeddingService(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE, embeddingService);
  }

  /**
   * Perform hybrid search combining FTS and Vectorize results
   *
   * @param query - Search query string
   * @param filters - Optional filters
   * @param k - RRF parameter (default 60)
   * @returns Array of search results with hybrid scores and source attribution
   */
  async search(
    query: string,
    filters?: SearchFilters,
    k: number = 60
  ): Promise<SearchResultItem[]> {
    const limit = filters?.limit ?? 10;

    // Execute FTS and Vectorize searches in parallel
    const [ftsResults, vectorResults] = await Promise.all([
      this.executeFtsSearch(query, filters, limit),
      this.executeVectorSearch(query, filters, limit),
    ]);

    // Merge results using RRF
    const mergedResults = this.mergeWithRRF(ftsResults, vectorResults, k);

    // Apply post-merge limit
    return mergedResults.slice(0, limit);
  }

  /**
   * Execute FTS lexical search
   */
  private async executeFtsSearch(
    query: string,
    filters?: SearchFilters,
    limit?: number
  ): Promise<SearchResultItem[]> {
    try {
      return await this.ftsService.search(query, { ...filters, limit: limit ? limit * 2 : 20 });
    } catch (error) {
      console.error('FTS search error:', error);
      return [];
    }
  }

  /**
   * Execute Vectorize semantic search
   */
  private async executeVectorSearch(
    query: string,
    filters?: SearchFilters,
    limit?: number
  ): Promise<SearchResultItem[]> {
    try {
      // Build Vectorize filter from search filters (category only for now)
      const vectorFilter = this.buildVectorizeFilter(filters);

      // Search Vectorize
      const results = await this.vectorizeService.search(
        query,
        limit ? limit * 2 : 20,
        vectorFilter
      );

      // Fetch work notes from D1 for matched IDs with person/dept filters applied
      const workNotes = await this.fetchWorkNotesByIds(
        results.map((r) => r.id),
        filters
      );

      // Combine with scores and source
      const searchResults: SearchResultItem[] = [];
      for (const result of results) {
        const workNote = workNotes.get(result.id);
        if (workNote) {
          searchResults.push({
            workNote,
            score: result.score,
            source: 'SEMANTIC',
          });
        }
      }
      return searchResults;
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }

  /**
   * Merge FTS and Vectorize results using Reciprocal Rank Fusion (RRF)
   *
   * RRF formula: score = sum(1 / (k + rank)) for each result set
   *
   * @param ftsResults - FTS search results
   * @param vectorResults - Vectorize search results
   * @param k - RRF constant (default 60, based on research)
   * @returns Merged and sorted results
   */
  private mergeWithRRF(
    ftsResults: SearchResultItem[],
    vectorResults: SearchResultItem[],
    k: number
  ): SearchResultItem[] {
    const scoreMap = new Map<
      string,
      { score: number; item: SearchResultItem; sources: Set<string> }
    >();

    // Add FTS scores
    ftsResults.forEach((item, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);

      const existing = scoreMap.get(item.workNote.workId);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add('LEXICAL');
      } else {
        scoreMap.set(item.workNote.workId, {
          score: rrfScore,
          item,
          sources: new Set(['LEXICAL']),
        });
      }
    });

    // Add Vector scores
    vectorResults.forEach((item, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);

      const existing = scoreMap.get(item.workNote.workId);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add('SEMANTIC');
      } else {
        scoreMap.set(item.workNote.workId, {
          score: rrfScore,
          item,
          sources: new Set(['SEMANTIC']),
        });
      }
    });

    // Convert to array and sort by combined score
    const merged = Array.from(scoreMap.values())
      .map(({ score, item, sources }) => ({
        workNote: item.workNote,
        score,
        source: this.determineSource(sources),
      }))
      .sort((a, b) => b.score - a.score);

    return merged;
  }

  /**
   * Determine source attribution based on which search engines found the result
   */
  private determineSource(sources: Set<string>): 'LEXICAL' | 'SEMANTIC' | 'HYBRID' {
    if (sources.has('LEXICAL') && sources.has('SEMANTIC')) {
      return 'HYBRID';
    } else if (sources.has('LEXICAL')) {
      return 'LEXICAL';
    } else {
      return 'SEMANTIC';
    }
  }

  /**
   * Build Vectorize metadata filter from search filters
   * Note: Only category is used here. Person and department filters are applied
   * via D1 query in fetchWorkNotesByIds() for accurate filtering.
   */
  private buildVectorizeFilter(filters?: SearchFilters): Record<string, string> | undefined {
    if (!filters) return undefined;

    const vectorFilter: Record<string, string> = {};

    if (filters.category) {
      vectorFilter.category = filters.category;
    }

    return Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined;
  }

  /**
   * Fetch work notes by IDs from D1 with optional filters
   *
   * @param workIds - Work note IDs to fetch
   * @param filters - Optional filters to apply (personId, deptName)
   * @returns Map of work note ID to work note
   */
  private async fetchWorkNotesByIds(
    workIds: string[],
    filters?: SearchFilters
  ): Promise<Map<string, WorkNote>> {
    if (workIds.length === 0) {
      return new Map();
    }

    // Build SQL with parameter placeholders
    const placeholders = workIds.map(() => '?').join(',');
    let sql = `
      SELECT wn.work_id as workId, wn.title, wn.content_raw as contentRaw,
             wn.category, wn.created_at as createdAt, wn.updated_at as updatedAt
      FROM work_notes wn
    `;

    const conditions: string[] = [`wn.work_id IN (${placeholders})`];
    const params: unknown[] = [...workIds];

    // Apply person and department filters (same logic as FTS search)
    if (filters?.personId || filters?.deptName) {
      sql += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      sql += ` INNER JOIN persons p ON wnp.person_id = p.person_id`;

      if (filters?.personId) {
        conditions.push('wnp.person_id = ?');
        params.push(filters.personId);
      }

      if (filters?.deptName) {
        conditions.push('p.current_dept = ?');
        params.push(filters.deptName);
      }
    }

    sql += ` WHERE ${conditions.join(' AND ')}`;

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all<WorkNote>();

    const workNotesMap = new Map<string, WorkNote>();
    for (const workNote of result.results || []) {
      workNotesMap.set(workNote.workId, workNote);
    }

    return workNotesMap;
  }
}
