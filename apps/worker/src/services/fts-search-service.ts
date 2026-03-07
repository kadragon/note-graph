// Trace: SPEC-search-1, TASK-009
import type { SearchFilters, SearchResultItem } from '@shared/types/search';
import type { WorkNote } from '@shared/types/work-note';
import { buildWorkNoteFtsCte } from '../adapters/postgres-fts-dialect';
import type { DatabaseClient } from '../types/database';
import { buildWorkNoteTsQuery } from '../utils/work-notes-fts';

/**
 * FTS (Full-Text Search) service for lexical search using PostgreSQL tsvector
 */
export class FtsSearchService {
  constructor(private db: DatabaseClient) {}

  /**
   * Search work notes using PostgreSQL tsvector full-text search
   * Supports Korean partial matching and filters
   *
   * @param query - Search query string
   * @param filters - Optional filters (person, dept, category, date range)
   * @returns Array of search result items with LEXICAL source
   */
  async search(query: string, filters?: SearchFilters): Promise<SearchResultItem[]> {
    const limit = filters?.limit ?? 10;

    // Build FTS query
    const ftsQuery = buildWorkNoteTsQuery(query, 'OR');

    if (!ftsQuery) {
      return [];
    }

    // Build SQL query with CTE to filter FTS results first
    // This optimizes join by limiting rows before full table scan
    const cte = buildWorkNoteFtsCte();
    let sql = `
      ${cte.sql}
      SELECT
        wn.work_id as "workId",
        wn.title,
        wn.content_raw as "contentRaw",
        wn.category,
        wn.created_at as "createdAt",
        wn.updated_at as "updatedAt",
        fts.${cte.rankColumn} as fts_rank
      FROM fts_matches fts
      INNER JOIN work_notes wn ON ${cte.joinCondition}
    `;

    const conditions: string[] = [];
    const params: unknown[] = [ftsQuery];
    let paramIndex = 2;

    // Apply filters
    if (filters?.category) {
      conditions.push(`wn.category = $${paramIndex++}`);
      params.push(filters.category);
    }

    if (filters?.from) {
      conditions.push(`wn.created_at >= $${paramIndex++}`);
      params.push(filters.from);
    }

    if (filters?.to) {
      conditions.push(`wn.created_at <= $${paramIndex++}`);
      params.push(filters.to);
    }

    // Person and department filters
    // If both are specified, find work notes for that person who is in that department
    if (filters?.personId || filters?.deptName) {
      sql += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      sql += ` INNER JOIN persons p ON wnp.person_id = p.person_id`;

      if (filters?.personId) {
        conditions.push(`wnp.person_id = $${paramIndex++}`);
        params.push(filters.personId);
      }

      if (filters?.deptName) {
        conditions.push(`p.current_dept = $${paramIndex++}`);
        params.push(filters.deptName);
      }
    }

    // Add WHERE clause only if there are filter conditions
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Order by FTS rank (higher rank = better match)
    sql += ` ORDER BY fts.${cte.rankColumn} DESC`;

    // Add limit
    sql += ` LIMIT $${paramIndex}`;
    params.push(limit);

    // Execute query
    const { rows } = await this.db.query<WorkNote & { fts_rank: number }>(sql, params);

    // Convert to SearchResultItem format
    // FTS rank is negative (better matches are less negative), normalize to positive score
    return rows.map((row) => {
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
}
