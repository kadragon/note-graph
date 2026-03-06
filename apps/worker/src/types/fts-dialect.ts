export interface FtsDialect {
  /** CTE for work note FTS with rank scoring. SQL uses PostgreSQL numbered placeholders. */
  buildWorkNoteFtsCte(): { sql: string; rankColumn: string; joinCondition: string };

  /** CTE for work note BM25 with weighted scoring. SQL uses PostgreSQL numbered placeholders. */
  buildWorkNoteBm25Cte(): { sql: string; scoreColumn: string; joinCondition: string };

  /** CTE for meeting minute FTS with rank scoring. SQL uses PostgreSQL numbered placeholders. */
  buildMeetingMinuteFtsCte(): { sql: string; rankColumn: string; joinCondition: string };

  /** CTE for meeting minute FTS with rank scoring, ORDER BY rank ASC and LIMIT. SQL uses PostgreSQL numbered placeholders. */
  buildMeetingMinuteFtsCteWithLimit(): { sql: string; rankColumn: string; joinCondition: string };

  /** CTE for meeting minute FTS (filter only, no scoring). SQL uses PostgreSQL numbered placeholders. */
  buildMeetingMinuteFilterCte(): { sql: string; joinCondition: string };
}
