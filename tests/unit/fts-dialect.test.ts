import { D1FtsDialect } from '@worker/adapters/d1-fts-dialect';
import { PostgresFtsDialect } from '@worker/adapters/postgres-fts-dialect';
import type { FtsDialect } from '@worker/types/fts-dialect';
import { describe, expect, it } from 'vitest';

describe('D1FtsDialect', () => {
  const dialect: FtsDialect = new D1FtsDialect();

  describe('buildWorkNoteFtsCte', () => {
    it('returns SQL with notes_fts MATCH placeholder', () => {
      const result = dialect.buildWorkNoteFtsCte();
      expect(result.sql).toContain('notes_fts');
      expect(result.sql).toContain('MATCH');
      expect(result.sql).toContain('?');
    });

    it('returns rank as rankColumn', () => {
      const result = dialect.buildWorkNoteFtsCte();
      expect(result.rankColumn).toBe('rank');
    });

    it('joins on rowid', () => {
      const result = dialect.buildWorkNoteFtsCte();
      expect(result.joinCondition).toContain('rowid');
    });
  });

  describe('buildWorkNoteBm25Cte', () => {
    it('returns SQL with bm25 scoring function', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.sql).toContain('bm25(notes_fts');
      expect(result.sql).toContain('MATCH');
      expect(result.sql).toContain('?');
    });

    it('returns bm25_score as scoreColumn', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.scoreColumn).toBe('bm25_score');
    });

    it('joins on rowid', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.joinCondition).toContain('rowid');
    });

    it('includes ORDER BY and LIMIT placeholders', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.sql).toContain('ORDER BY');
      expect(result.sql).toContain('LIMIT');
    });
  });

  describe('buildMeetingMinuteFtsCte', () => {
    it('returns SQL with meeting_minutes_fts MATCH', () => {
      const result = dialect.buildMeetingMinuteFtsCte();
      expect(result.sql).toContain('meeting_minutes_fts');
      expect(result.sql).toContain('MATCH');
    });

    it('returns rank as rankColumn', () => {
      const result = dialect.buildMeetingMinuteFtsCte();
      expect(result.rankColumn).toBe('rank');
    });

    it('joins on rowid', () => {
      const result = dialect.buildMeetingMinuteFtsCte();
      expect(result.joinCondition).toContain('rowid');
    });
  });

  describe('buildMeetingMinuteFtsCteWithLimit', () => {
    it('returns SQL with meeting_minutes_fts MATCH and LIMIT', () => {
      const result = dialect.buildMeetingMinuteFtsCteWithLimit();
      expect(result.sql).toContain('meeting_minutes_fts');
      expect(result.sql).toContain('MATCH');
      expect(result.sql).toContain('ORDER BY');
      expect(result.sql).toContain('LIMIT');
    });

    it('returns rank as rankColumn', () => {
      const result = dialect.buildMeetingMinuteFtsCteWithLimit();
      expect(result.rankColumn).toBe('rank');
    });

    it('uses two query parameters (ftsQuery, limit)', () => {
      const result = dialect.buildMeetingMinuteFtsCteWithLimit();
      const paramCount = (result.sql.match(/\?/g) || []).length;
      expect(paramCount).toBe(2);
    });
  });

  describe('buildMeetingMinuteFilterCte', () => {
    it('returns SQL with meeting_minutes_fts MATCH', () => {
      const result = dialect.buildMeetingMinuteFilterCte();
      expect(result.sql).toContain('meeting_minutes_fts');
      expect(result.sql).toContain('MATCH');
    });

    it('joins on rowid', () => {
      const result = dialect.buildMeetingMinuteFilterCte();
      expect(result.joinCondition).toContain('rowid');
    });

    it('does not include rank column in SQL', () => {
      const result = dialect.buildMeetingMinuteFilterCte();
      expect(result.sql).not.toContain('rank');
    });
  });

  describe('isAlwaysSynced', () => {
    it('returns false for D1 trigger-based FTS', () => {
      expect(dialect.isAlwaysSynced()).toBe(false);
    });
  });

  describe('isTsQuerySyntax', () => {
    it('returns false for D1 FTS5 MATCH syntax', () => {
      expect(dialect.isTsQuerySyntax()).toBe(false);
    });
  });
});

describe('PostgresFtsDialect', () => {
  const dialect: FtsDialect = new PostgresFtsDialect();

  describe('buildWorkNoteFtsCte', () => {
    it('returns SQL with tsvector match operator', () => {
      const result = dialect.buildWorkNoteFtsCte();
      expect(result.sql).toContain('fts_vector @@');
      expect(result.sql).toContain('to_tsquery');
    });

    it('returns rank as rankColumn', () => {
      const result = dialect.buildWorkNoteFtsCte();
      expect(result.rankColumn).toBe('rank');
    });

    it('joins on work_id', () => {
      const result = dialect.buildWorkNoteFtsCte();
      expect(result.joinCondition).toContain('work_id');
    });

    it('uses single query parameter via lateral join', () => {
      const result = dialect.buildWorkNoteFtsCte();
      const paramCount = (result.sql.match(/\?/g) || []).length;
      expect(paramCount).toBe(1);
    });
  });

  describe('buildWorkNoteBm25Cte', () => {
    it('returns SQL with ts_rank_cd scoring', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.sql).toContain('ts_rank_cd');
      expect(result.sql).toContain('to_tsquery');
    });

    it('returns bm25_score as scoreColumn', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.scoreColumn).toBe('bm25_score');
    });

    it('joins on work_id', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.joinCondition).toContain('work_id');
    });

    it('includes ORDER BY and LIMIT', () => {
      const result = dialect.buildWorkNoteBm25Cte();
      expect(result.sql).toContain('ORDER BY');
      expect(result.sql).toContain('LIMIT');
    });
  });

  describe('buildMeetingMinuteFtsCte', () => {
    it('returns SQL with tsvector match operator', () => {
      const result = dialect.buildMeetingMinuteFtsCte();
      expect(result.sql).toContain('fts_vector @@');
      expect(result.sql).toContain('to_tsquery');
    });

    it('returns rank as rankColumn', () => {
      const result = dialect.buildMeetingMinuteFtsCte();
      expect(result.rankColumn).toBe('rank');
    });

    it('joins on meeting_id', () => {
      const result = dialect.buildMeetingMinuteFtsCte();
      expect(result.joinCondition).toContain('meeting_id');
    });
  });

  describe('buildMeetingMinuteFtsCteWithLimit', () => {
    it('returns SQL with tsvector match, ORDER BY, and LIMIT', () => {
      const result = dialect.buildMeetingMinuteFtsCteWithLimit();
      expect(result.sql).toContain('fts_vector @@');
      expect(result.sql).toContain('to_tsquery');
      expect(result.sql).toContain('ORDER BY');
      expect(result.sql).toContain('LIMIT');
    });

    it('returns rank as rankColumn', () => {
      const result = dialect.buildMeetingMinuteFtsCteWithLimit();
      expect(result.rankColumn).toBe('rank');
    });

    it('uses two query parameters (ftsQuery, limit)', () => {
      const result = dialect.buildMeetingMinuteFtsCteWithLimit();
      const paramCount = (result.sql.match(/\?/g) || []).length;
      expect(paramCount).toBe(2);
    });
  });

  describe('buildMeetingMinuteFilterCte', () => {
    it('returns SQL with tsvector match operator', () => {
      const result = dialect.buildMeetingMinuteFilterCte();
      expect(result.sql).toContain('fts_vector @@');
      expect(result.sql).toContain('to_tsquery');
    });

    it('joins on meeting_id', () => {
      const result = dialect.buildMeetingMinuteFilterCte();
      expect(result.joinCondition).toContain('meeting_id');
    });
  });

  describe('isAlwaysSynced', () => {
    it('returns true for PostgreSQL generated columns', () => {
      expect(dialect.isAlwaysSynced()).toBe(true);
    });
  });

  describe('isTsQuerySyntax', () => {
    it('returns true for PostgreSQL tsquery syntax', () => {
      expect(dialect.isTsQuerySyntax()).toBe(true);
    });
  });
});
