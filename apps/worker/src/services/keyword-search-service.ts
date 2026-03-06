import type { SearchFilters, SearchResultItem } from '@shared/types/search';
import type { WorkNote } from '@shared/types/work-note';
import { buildWorkNoteBm25Cte } from '../adapters/postgres-fts-dialect';
import type { DatabaseClient } from '../types/database';
import {
  buildWorkNoteTsQuery,
  extractWorkNoteFtsTokens,
  normalizeWorkNoteSearchPhrase,
} from '../utils/work-notes-fts';

interface KeywordCandidateRow {
  workId: string;
  title: string;
  contentRaw: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  bm25Score: number;
}

const TITLE_EXACT_BOOST = 0.12;
const TITLE_PHRASE_BOOST = 0.08;
const TITLE_TOKEN_COVERAGE_MAX_BOOST = 0.1;
const TEXT_SCORE_WEIGHT = 0.75;
const RECENCY_MAX_BOOST = 0.05;
const RECENCY_HALF_LIFE_DAYS = 180;
const DAY_MS = 1000 * 60 * 60 * 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toTimestamp(isoString: string): number | null {
  const value = Date.parse(isoString);
  return Number.isFinite(value) ? value : null;
}

export class KeywordSearchService {
  constructor(private db: DatabaseClient) {}

  private buildQuery(rawQuery: string, operator: 'AND' | 'OR'): string {
    return buildWorkNoteTsQuery(rawQuery, operator);
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResultItem[]> {
    const limit = Math.min(filters?.limit ?? 10, 100);
    const andQuery = this.buildQuery(query, 'AND');
    const orQuery = this.buildQuery(query, 'OR');
    const tokens = extractWorkNoteFtsTokens(query).map((token) => token.toLowerCase());

    if (!andQuery) {
      return [];
    }

    const candidateLimit = Math.min(Math.max(limit * 6, 40), 200);
    const primaryRows = await this.searchCandidates(andQuery, filters, candidateLimit);

    let mergedRows = primaryRows;
    if (primaryRows.length < limit && orQuery !== andQuery) {
      const fallbackRows = await this.searchCandidates(orQuery, filters, candidateLimit);
      const map = new Map<string, KeywordCandidateRow>();

      for (const row of primaryRows) {
        map.set(row.workId, row);
      }
      for (const row of fallbackRows) {
        const existing = map.get(row.workId);
        if (!existing || row.bm25Score < existing.bm25Score) {
          map.set(row.workId, row);
        }
      }

      mergedRows = [...map.values()];
    }

    if (mergedRows.length === 0) {
      return [];
    }

    const rankedByText = [...mergedRows].sort((left, right) => left.bm25Score - right.bm25Score);
    const textScoreById = new Map<string, number>();
    const denominator = rankedByText.length + 2;

    rankedByText.forEach((row, index) => {
      const textScore = rankedByText.length === 1 ? 1 : 1 - index / denominator;
      textScoreById.set(row.workId, textScore);
    });

    const phrase = normalizeWorkNoteSearchPhrase(query).toLowerCase();
    const now = Date.now();

    const scoredResults = mergedRows.map((row) => {
      const workNote: WorkNote = {
        workId: row.workId,
        title: row.title,
        contentRaw: row.contentRaw,
        category: row.category,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        embeddedAt: null,
      };

      const textScore = textScoreById.get(row.workId) ?? 0;
      const titleLower = row.title.toLowerCase();

      let titleBoost = 0;
      if (phrase && titleLower === phrase) {
        titleBoost += TITLE_EXACT_BOOST;
      }
      if (phrase && titleLower.includes(phrase)) {
        titleBoost += TITLE_PHRASE_BOOST;
      }
      if (tokens.length > 0) {
        const matchedTokens = tokens.filter((token) => titleLower.includes(token)).length;
        titleBoost += (matchedTokens / tokens.length) * TITLE_TOKEN_COVERAGE_MAX_BOOST;
      }

      const createdAtTs = toTimestamp(row.createdAt);
      const recencyBoost =
        createdAtTs === null
          ? 0
          : RECENCY_MAX_BOOST *
            Math.exp(-Math.max(now - createdAtTs, 0) / DAY_MS / RECENCY_HALF_LIFE_DAYS);

      const score = clamp(TEXT_SCORE_WEIGHT * textScore + titleBoost + recencyBoost, 0, 1);

      return {
        workNote,
        score,
        source: 'LEXICAL' as const,
      };
    });

    return scoredResults
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.workNote.createdAt.localeCompare(left.workNote.createdAt);
      })
      .slice(0, limit);
  }

  private async searchCandidates(
    ftsQuery: string,
    filters: SearchFilters | undefined,
    candidateLimit: number
  ): Promise<KeywordCandidateRow[]> {
    const cte = buildWorkNoteBm25Cte();
    let sql = `
      ${cte.sql}
      SELECT
        wn.work_id as workId,
        wn.title,
        wn.content_raw as contentRaw,
        wn.category,
        wn.created_at as createdAt,
        wn.updated_at as updatedAt,
        fts.${cte.scoreColumn} as bm25Score
      FROM fts_matches fts
      INNER JOIN work_notes wn ON ${cte.joinCondition}
    `;

    const conditions: string[] = [];
    const params: unknown[] = [ftsQuery, candidateLimit];
    let paramIndex = 3;

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

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY fts.${cte.scoreColumn} ASC`;

    const { rows } = await this.db.query<KeywordCandidateRow>(sql, params);

    return rows;
  }
}
