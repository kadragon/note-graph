import { PostgresFtsDialect } from '@worker/adapters/postgres-fts-dialect';
import type { FtsDialect } from '@worker/types/fts-dialect';
import { describe, expect, it } from 'vitest';

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

    it('uses $1 for the tsquery parameter', () => {
      const result = dialect.buildWorkNoteFtsCte();
      expect(result.sql).toContain('$1');
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

    it('uses $1 for tsquery and $2 for limit', () => {
      const result = dialect.buildMeetingMinuteFtsCteWithLimit();
      expect(result.sql).toContain('$1');
      expect(result.sql).toContain('$2');
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
