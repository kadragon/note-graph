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
    // unicode61 tokenizer handles Korean text well
    const ftsQuery = this.buildFtsQuery(query);

    // Build SQL query with filters
    let sql = `
      SELECT
        wn.work_id as workId,
        wn.title,
        wn.content_raw as contentRaw,
        wn.category,
        wn.created_at as createdAt,
        wn.updated_at as updatedAt,
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

    // Person and department filters
    // If both are specified, find work notes for that person who is in that department
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
   * Uses unicode61 tokenizer for Korean text support
   *
   * @param query - User search query
   * @returns FTS query string
   */
  private buildFtsQuery(query: string): string {
    // Clean query
    const cleaned = query.trim();

    // For unicode61 tokenizer, simple term matching works well
    // For multi-word queries, FTS5 will match documents containing any of the terms
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
