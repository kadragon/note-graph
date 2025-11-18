// Trace: SPEC-search-1, TASK-009
import type { D1Database } from '@cloudflare/workers-types';
import type { WorkNote } from '../types/work-note';
import type { SearchFilters, SearchResultItem } from '../types/search';

/**
 * FTS (Full-Text Search) service for lexical search using D1 FTS5
 */
export class FtsSearchService {
  constructor(private db: D1Database) {}

  /**
   * Search work notes using FTS5 with trigram tokenizer
   * Supports Korean partial matching and filters
   *
   * @param query - Search query string
   * @param filters - Optional filters (person, dept, category, date range)
   * @returns Array of search result items with LEXICAL source
   */
  async search(query: string, filters?: SearchFilters): Promise<SearchResultItem[]> {
    const limit = filters?.limit ?? 10;

    // Build FTS query
    // Trigram tokenizer automatically handles Korean partial matching
    const ftsQuery = this.buildFtsQuery(query);

    // Build SQL query with filters
    let sql = `
      SELECT
        wn.work_id,
        wn.title,
        wn.content_raw,
        wn.category,
        wn.created_at,
        wn.updated_at,
        fts.rank as fts_rank
      FROM notes_fts fts
      INNER JOIN work_notes wn ON wn.rowid = fts.rowid
    `;

    const conditions: string[] = [`notes_fts MATCH ?`];
    const params: unknown[] = [ftsQuery];

    // Apply filters
    if (filters?.category) {
      conditions.push('wn.category = ?');
      params.push(filters.category);
    }

    if (filters?.from) {
      conditions.push('wn.created_at >= ?');
      params.push(filters.from);
    }

    if (filters?.to) {
      conditions.push('wn.created_at <= ?');
      params.push(filters.to);
    }

    // Person filter requires join
    if (filters?.personId) {
      sql += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      conditions.push('wnp.person_id = ?');
      params.push(filters.personId);
    }

    // Department filter requires join
    if (filters?.deptName) {
      sql += `
        INNER JOIN work_note_person wnp2 ON wn.work_id = wnp2.work_id
        INNER JOIN persons p ON wnp2.person_id = p.person_id
      `;
      conditions.push('p.current_dept = ?');
      params.push(filters.deptName);
    }

    // Add WHERE clause
    sql += ` WHERE ${conditions.join(' AND ')}`;

    // Order by FTS rank (higher rank = better match)
    sql += ` ORDER BY fts.rank DESC`;

    // Add limit
    sql += ` LIMIT ?`;
    params.push(limit);

    // Execute query
    const result = await this.db.prepare(sql).bind(...params).all<WorkNote & { fts_rank: number }>();

    if (!result.success) {
      throw new Error('FTS search query failed');
    }

    // Convert to SearchResultItem format
    // FTS rank is negative (better matches are less negative), normalize to positive score
    return result.results.map((row) => {
      const { fts_rank, ...workNote } = row;

      // Normalize FTS rank to 0-1 range
      // FTS rank is typically between -10 and 0
      const score = Math.max(0, 1 + fts_rank / 10);

      return {
        workNote: workNote as WorkNote,
        score,
        source: 'LEXICAL' as const,
      };
    });
  }

  /**
   * Build FTS query string from user input
   * Uses trigram tokenizer which automatically handles Korean partial matching
   *
   * @param query - User search query
   * @returns FTS query string
   */
  private buildFtsQuery(query: string): string {
    // Clean query
    const cleaned = query.trim();

    // For trigram tokenizer, don't use quotes - let trigram do partial matching
    // Trigram breaks text into 3-character sequences, enabling substring matching
    return cleaned;
  }

  /**
   * Verify FTS synchronization by checking if triggers are working
   * Useful for testing and debugging
   *
   * @returns True if FTS is synchronized with work_notes
   */
  async verifyFtsSync(): Promise<boolean> {
    const result = await this.db
      .prepare(
        `
      SELECT
        (SELECT COUNT(*) FROM work_notes) as work_notes_count,
        (SELECT COUNT(*) FROM notes_fts) as fts_count
    `
      )
      .first<{ work_notes_count: number; fts_count: number }>();

    if (!result) {
      return false;
    }

    return result.work_notes_count === result.fts_count;
  }
}
