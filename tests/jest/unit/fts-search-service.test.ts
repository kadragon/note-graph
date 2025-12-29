// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-004
// Unit tests for FTS Search Service - Migrated from Vitest to Jest

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { jest } from '@jest/globals';
import { FtsSearchService } from '@worker/services/fts-search-service';

describe('FtsSearchService', () => {
  let mockDb: D1Database;
  let ftsService: FtsSearchService;

  beforeEach(() => {
    // Reset mock database before each test
    mockDb = {} as D1Database;
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

      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: mockResults,
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

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

      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: mockResults,
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      const results = await ftsService.search('test');

      // FTS rank -1 should normalize to exactly 0.9
      // Formula: Math.max(0, 1 + fts_rank / 10) = 1 + (-1)/10 = 0.9
      expect(results[0].score).toBe(0.9);

      // FTS rank -5 should normalize to exactly 0.5
      // Formula: Math.max(0, 1 + fts_rank / 10) = 1 + (-5)/10 = 0.5
      expect(results[1].score).toBe(0.5);
    });

    it('should apply category filter', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('업무', { category: '회의' });

      // Verify SQL includes category filter
      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('wn.category = ?');
      expect((mockStmt.bind as jest.Mock).mock.calls[0]).toContain('회의');
    });

    it('should apply date range filters', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('업무', {
        from: '2024-01-01',
        to: '2024-12-31',
      });

      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('wn.created_at >= ?');
      expect(sqlCall).toContain('wn.created_at <= ?');

      const bindCalls = (mockStmt.bind as jest.Mock).mock.calls[0];
      expect(bindCalls).toContain('2024-01-01');
      expect(bindCalls).toContain('2024-12-31');
    });

    it('should apply person ID filter', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('업무', { personId: 'P-001' });

      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('work_note_person');
      expect(sqlCall).toContain('wnp.person_id = ?');
      expect((mockStmt.bind as jest.Mock).mock.calls[0]).toContain('P-001');
    });

    it('should apply department filter', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('업무', { deptName: '개발팀' });

      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('persons p');
      expect(sqlCall).toContain('p.current_dept = ?');
      expect((mockStmt.bind as jest.Mock).mock.calls[0]).toContain('개발팀');
    });

    it('should apply limit parameter', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('업무', { limit: 20 });

      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('LIMIT ?');
      const bindCalls = (mockStmt.bind as jest.Mock).mock.calls[0];
      expect(bindCalls[bindCalls.length - 1]).toBe(20);
    });

    it('should use default limit of 10', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('업무');

      const bindCalls = (mockStmt.bind as jest.Mock).mock.calls[0];
      expect(bindCalls[bindCalls.length - 1]).toBe(10);
    });

    it('should combine person and department filters', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('업무', {
        personId: 'P-001',
        deptName: '개발팀',
      });

      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('work_note_person');
      expect(sqlCall).toContain('wnp.person_id = ?');
      expect(sqlCall).toContain('p.current_dept = ?');
    });

    it('should handle empty search results', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      const results = await ftsService.search('nonexistent');

      expect(results).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: false,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await expect(ftsService.search('업무')).rejects.toThrow('FTS search query failed');
    });

    it('should handle Korean text queries', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('한글 검색어');

      const bindCalls = (mockStmt.bind as jest.Mock).mock.calls[0];
      expect(bindCalls[0]).toBe('한글 검색어');
    });

    it('should trim whitespace from query', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('  업무 보고  ');

      const bindCalls = (mockStmt.bind as jest.Mock).mock.calls[0];
      expect(bindCalls[0]).toBe('업무 보고');
    });

    it('should order results by FTS rank descending', async () => {
      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: [],
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.search('test');

      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('ORDER BY fts.rank DESC');
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

      const mockStmt = {
        bind: jest.fn<any>().mockReturnThis(),
        all: jest.fn<any>().mockResolvedValue({
          success: true,
          results: mockResults,
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      const results = await ftsService.search('test');

      expect(results[0].workNote).not.toHaveProperty('fts_rank');
      expect(results[0].workNote).toHaveProperty('workId');
      expect(results[0].workNote).toHaveProperty('title');
    });
  });

  describe('verifyFtsSync()', () => {
    it('should return true when counts match', async () => {
      const mockStmt = {
        first: jest.fn<any>().mockResolvedValue({
          work_notes_count: 100,
          fts_count: 100,
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      const result = await ftsService.verifyFtsSync();

      expect(result).toBe(true);
    });

    it('should return false when counts do not match', async () => {
      const mockStmt = {
        first: jest.fn<any>().mockResolvedValue({
          work_notes_count: 100,
          fts_count: 95,
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      const result = await ftsService.verifyFtsSync();

      expect(result).toBe(false);
    });

    it('should return false when no result', async () => {
      const mockStmt = {
        first: jest.fn<any>().mockResolvedValue(null),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      const result = await ftsService.verifyFtsSync();

      expect(result).toBe(false);
    });

    it('should query both work_notes and notes_fts tables', async () => {
      const mockStmt = {
        first: jest.fn<any>().mockResolvedValue({
          work_notes_count: 50,
          fts_count: 50,
        }),
      } as unknown as D1PreparedStatement;

      mockDb.prepare = jest.fn<any>().mockReturnValue(mockStmt) as any;

      await ftsService.verifyFtsSync();

      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('work_notes');
      expect(sqlCall).toContain('notes_fts');
    });
  });
});
