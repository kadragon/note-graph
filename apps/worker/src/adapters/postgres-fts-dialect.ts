import type { FtsDialect } from '../types/fts-dialect';

export class PostgresFtsDialect implements FtsDialect {
  buildWorkNoteFtsCte(): { sql: string; rankColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT work_id AS id, -ts_rank(fts_vector, query) AS rank FROM work_notes, to_tsquery('simple', $1) AS query WHERE fts_vector @@ query)`,
      rankColumn: 'rank',
      joinCondition: 'wn.work_id = fts.id',
    };
  }

  buildWorkNoteBm25Cte(): { sql: string; scoreColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT work_id AS id, -ts_rank_cd(fts_vector, query, 1) AS bm25_score FROM work_notes, to_tsquery('simple', $1) AS query WHERE fts_vector @@ query ORDER BY bm25_score ASC LIMIT $2)`,
      scoreColumn: 'bm25_score',
      joinCondition: 'wn.work_id = fts.id',
    };
  }

  buildMeetingMinuteFtsCte(): { sql: string; rankColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT meeting_id AS id, -ts_rank(fts_vector, query) AS rank FROM meeting_minutes, to_tsquery('simple', $1) AS query WHERE fts_vector @@ query)`,
      rankColumn: 'rank',
      joinCondition: 'mm.meeting_id = fts.id',
    };
  }

  buildMeetingMinuteFtsCteWithLimit(): { sql: string; rankColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT meeting_id AS id, -ts_rank(fts_vector, query) AS rank FROM meeting_minutes, to_tsquery('simple', $1) AS query WHERE fts_vector @@ query ORDER BY rank ASC LIMIT $2)`,
      rankColumn: 'rank',
      joinCondition: 'mm.meeting_id = fts.id',
    };
  }

  buildMeetingMinuteFilterCte(): { sql: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT meeting_id AS id FROM meeting_minutes WHERE fts_vector @@ to_tsquery('simple', $1))`,
      joinCondition: 'fts.id = mm.meeting_id',
    };
  }

  isAlwaysSynced(): boolean {
    return true;
  }

  isTsQuerySyntax(): boolean {
    return true;
  }
}
