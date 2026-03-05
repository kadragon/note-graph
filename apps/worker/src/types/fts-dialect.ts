export interface FtsDialect {
  /** CTE for work note FTS with rank scoring. SQL uses ? placeholder for ftsQuery. */
  buildWorkNoteFtsCte(): { sql: string; rankColumn: string; joinCondition: string };

  /** CTE for work note BM25 with weighted scoring. SQL uses ? for ftsQuery and ? for limit. */
  buildWorkNoteBm25Cte(): { sql: string; scoreColumn: string; joinCondition: string };

  /** CTE for meeting minute FTS with rank scoring. SQL uses ? for ftsQuery. */
  buildMeetingMinuteFtsCte(): { sql: string; rankColumn: string; joinCondition: string };

  /** CTE for meeting minute FTS (filter only, no scoring). SQL uses ? for ftsQuery. */
  buildMeetingMinuteFilterCte(): { sql: string; joinCondition: string };

  /** Whether FTS is always in sync (PostgreSQL generated column = true, D1 trigger-based = false). */
  isAlwaysSynced(): boolean;
}
