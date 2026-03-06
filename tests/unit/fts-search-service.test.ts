// Trace: SPEC-search-1, TASK-009, TASK-016
// Unit tests for FTS Search Service

import { FtsSearchService } from '@worker/services/fts-search-service';
import type { DatabaseClient } from '@worker/types/database';
import { buildWorkNoteTsQuery } from '@worker/utils/work-notes-fts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createMockDb(queryResult: { rows: unknown[] } = { rows: [] }): DatabaseClient {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
    transaction: vi.fn(),
    executeBatch: vi.fn(),
  } as unknown as DatabaseClient;
}

describe('FtsSearchService', () => {
  let mockDb: DatabaseClient;
  let ftsService: FtsSearchService;

  beforeEach(() => {
    mockDb = createMockDb();
    ftsService = new FtsSearchService(mockDb);
  });

  describe('search()', () => {
    it('should perform basic FTS search', async () => {
      const mockResults = [
        {
          workId: 'WORK-001',
          title: '업무 보고서',
          contentRaw: '2024년 업무 내용',
          category: '보고',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          fts_rank: -1.5,
        },
      ];

      mockDb = createMockDb({ rows: mockResults });
      ftsService = new FtsSearchService(mockDb);

      const results = await ftsService.search('업무');

      expect(results).toHaveLength(1);
      expect(results[0].workNote.workId).toBe('WORK-001');
      expect(results[0].source).toBe('LEXICAL');
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    });

    it('should normalize FTS rank to 0-1 score range', async () => {
      const mockResults = [
        {
          workId: 'WORK-001',
          title: 'Test',
          contentRaw: 'Content',
          category: '업무',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          fts_rank: -1,
        },
        {
          workId: 'WORK-002',
          title: 'Test 2',
          contentRaw: 'Content 2',
          category: '업무',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          fts_rank: -5,
        },
      ];

      mockDb = createMockDb({ rows: mockResults });
      ftsService = new FtsSearchService(mockDb);

      const results = await ftsService.search('test');

      expect(results[0].score).toBe(0.9);
      expect(results[1].score).toBe(0.5);
    });

    it('should apply category filter', async () => {
      await ftsService.search('업무', { category: '회의' });

      const [sql, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('wn.category = $2');
      expect(params).toContain('회의');
    });

    it('should apply date range filters', async () => {
      await ftsService.search('업무', {
        from: '2024-01-01',
        to: '2024-12-31',
      });

      const [sql, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('wn.created_at >= $2');
      expect(sql).toContain('wn.created_at <= $3');
      expect(params).toContain('2024-01-01');
      expect(params).toContain('2024-12-31');
    });

    it('should apply person ID filter', async () => {
      await ftsService.search('업무', { personId: 'P-001' });

      const [sql, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('work_note_person');
      expect(sql).toContain('wnp.person_id = $2');
      expect(params).toContain('P-001');
    });

    it('should apply department filter', async () => {
      await ftsService.search('업무', { deptName: '개발팀' });

      const [sql, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('persons p');
      expect(sql).toContain('p.current_dept = $2');
      expect(params).toContain('개발팀');
    });

    it('should apply limit parameter', async () => {
      await ftsService.search('업무', { limit: 20 });

      const [sql, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('LIMIT $2');
      expect(params[params.length - 1]).toBe(20);
    });

    it('should use default limit of 10', async () => {
      await ftsService.search('업무');

      const [, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params[params.length - 1]).toBe(10);
    });

    it('should combine person and department filters', async () => {
      await ftsService.search('업무', {
        personId: 'P-001',
        deptName: '개발팀',
      });

      const [sql] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('work_note_person');
      expect(sql).toContain('wnp.person_id = $2');
      expect(sql).toContain('p.current_dept = $3');
    });

    it('should handle empty search results', async () => {
      const results = await ftsService.search('nonexistent');
      expect(results).toEqual([]);
    });

    it('should handle Korean text queries', async () => {
      await ftsService.search('한글 검색어');

      const [, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params[0]).toBe(buildWorkNoteTsQuery('한글 검색어', 'OR'));
    });

    it('should trim whitespace from query', async () => {
      await ftsService.search('  업무 보고  ');

      const [, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params[0]).toBe(buildWorkNoteTsQuery('업무 보고', 'OR'));
    });

    it('should order results by FTS rank descending', async () => {
      await ftsService.search('test');

      const [sql] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('ORDER BY fts.rank DESC');
    });

    it('should use CTE to filter FTS matches before joining work_notes', async () => {
      await ftsService.search('업무');

      const [sql] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toMatch(/WITH\s+fts_matches\s+AS/i);
      expect(sql).toMatch(/fts_matches\s+AS\s*\(\s*SELECT.*to_tsquery/is);
      expect(sql).toMatch(/FROM\s+fts_matches\s+fts/i);
    });

    it('should exclude fts_rank from returned work note', async () => {
      const mockResults = [
        {
          workId: 'WORK-001',
          title: 'Test',
          contentRaw: 'Content',
          category: '업무',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          fts_rank: -2.0,
        },
      ];

      mockDb = createMockDb({ rows: mockResults });
      ftsService = new FtsSearchService(mockDb);

      const results = await ftsService.search('test');

      expect(results[0].workNote).not.toHaveProperty('fts_rank');
      expect(results[0].workNote).toHaveProperty('workId');
      expect(results[0].workNote).toHaveProperty('title');
    });

    it('should return empty array for empty query tokens', async () => {
      const results = await ftsService.search('   ');
      expect(results).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});
