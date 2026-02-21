import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { KeywordSearchService } from '@worker/services/keyword-search-service';
import { describe, expect, it, vi } from 'vitest';

describe('KeywordSearchService', () => {
  it('ranks title matches above content-only matches with title boost', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({
        success: true,
        results: [
          {
            workId: 'WORK-CONTENT',
            title: '주간 공유',
            contentRaw: '운영 검색 성능 개선 회의',
            category: '운영',
            createdAt: '2024-01-10T00:00:00.000Z',
            updatedAt: '2024-01-10T00:00:00.000Z',
            bm25Score: 0.05,
          },
          {
            workId: 'WORK-TITLE',
            title: '검색 성능',
            contentRaw: '주간 보고',
            category: '운영',
            createdAt: '2024-01-10T00:00:00.000Z',
            updatedAt: '2024-01-10T00:00:00.000Z',
            bm25Score: 0.2,
          },
        ],
      }),
    } as unknown as D1PreparedStatement;

    const mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    } as unknown as D1Database;

    const service = new KeywordSearchService(mockDb);

    const results = await service.search('검색 성능');

    expect(results).toHaveLength(2);
    expect(results[0]?.workNote.workId).toBe('WORK-TITLE');
    expect(results[0]?.source).toBe('LEXICAL');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it('falls back to OR query when AND results are insufficient', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          results: [
            {
              workId: 'WORK-AND',
              title: '검색 성능',
              contentRaw: 'AND 결과',
              category: '운영',
              createdAt: '2024-01-10T00:00:00.000Z',
              updatedAt: '2024-01-10T00:00:00.000Z',
              bm25Score: 0.05,
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          results: [
            {
              workId: 'WORK-OR',
              title: '검색 관련 메모',
              contentRaw: 'OR 추가 결과',
              category: '운영',
              createdAt: '2024-01-09T00:00:00.000Z',
              updatedAt: '2024-01-09T00:00:00.000Z',
              bm25Score: 0.2,
            },
          ],
        }),
    } as unknown as D1PreparedStatement;

    const mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    } as unknown as D1Database;

    const service = new KeywordSearchService(mockDb);
    const results = await service.search('검색 성능', { limit: 2 });

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.workNote.workId)).toEqual(
      expect.arrayContaining(['WORK-AND', 'WORK-OR'])
    );
    expect((mockStmt.bind as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain('AND');
    expect((mockStmt.bind as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toContain('OR');
  });

  it('returns empty results for punctuation-only query', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
    } as unknown as D1PreparedStatement;

    const mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    } as unknown as D1Database;

    const service = new KeywordSearchService(mockDb);
    const results = await service.search(' !!! ((( ))) ::: ');

    expect(results).toEqual([]);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('applies category/person/dept/date filters in candidate query', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({
        success: true,
        results: [],
      }),
    } as unknown as D1PreparedStatement;

    const mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    } as unknown as D1Database;

    const service = new KeywordSearchService(mockDb);
    await service.search('검색', {
      category: '운영',
      personId: 'P-001',
      deptName: '개발팀',
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.999Z',
      limit: 5,
    });

    const sqlCall = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    const bindCall = (mockStmt.bind as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];

    expect(sqlCall).toContain('work_note_person wnp');
    expect(sqlCall).toContain('persons p');
    expect(sqlCall).toContain('wn.category = ?');
    expect(sqlCall).toContain('wnp.person_id = ?');
    expect(sqlCall).toContain('p.current_dept = ?');
    expect(sqlCall).toContain('wn.created_at >= ?');
    expect(sqlCall).toContain('wn.created_at <= ?');

    expect(bindCall).toContain('운영');
    expect(bindCall).toContain('P-001');
    expect(bindCall).toContain('개발팀');
    expect(bindCall).toContain('2024-01-01T00:00:00.000Z');
    expect(bindCall).toContain('2024-12-31T23:59:59.999Z');
  });
});
