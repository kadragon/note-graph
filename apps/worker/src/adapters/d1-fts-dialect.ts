import type { FtsDialect } from '../types/fts-dialect';

export class D1FtsDialect implements FtsDialect {
  buildWorkNoteFtsCte(): { sql: string; rankColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT rowid, rank FROM notes_fts WHERE notes_fts MATCH ?)`,
      rankColumn: 'rank',
      joinCondition: 'wn.rowid = fts.rowid',
    };
  }

  buildWorkNoteBm25Cte(): { sql: string; scoreColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT rowid, bm25(notes_fts, 8.0, 2.0, 0.3) AS bm25_score FROM notes_fts WHERE notes_fts MATCH ? ORDER BY bm25_score ASC LIMIT ?)`,
      scoreColumn: 'bm25_score',
      joinCondition: 'wn.rowid = fts.rowid',
    };
  }

  buildMeetingMinuteFtsCte(): { sql: string; rankColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT rowid, rank FROM meeting_minutes_fts WHERE meeting_minutes_fts MATCH ?)`,
      rankColumn: 'rank',
      joinCondition: 'mm.rowid = fts.rowid',
    };
  }

  buildMeetingMinuteFtsCteWithLimit(): { sql: string; rankColumn: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT rowid, rank FROM meeting_minutes_fts WHERE meeting_minutes_fts MATCH ? ORDER BY rank ASC LIMIT ?)`,
      rankColumn: 'rank',
      joinCondition: 'mm.rowid = fts.rowid',
    };
  }

  buildMeetingMinuteFilterCte(): { sql: string; joinCondition: string } {
    return {
      sql: `WITH fts_matches AS (SELECT rowid FROM meeting_minutes_fts WHERE meeting_minutes_fts MATCH ?)`,
      joinCondition: 'fts.rowid = mm.rowid',
    };
  }

  isAlwaysSynced(): boolean {
    return false;
  }

  isTsQuerySyntax(): boolean {
    return false;
  }
}
