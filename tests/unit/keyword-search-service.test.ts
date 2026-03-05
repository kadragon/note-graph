import { D1FtsDialect } from '@worker/adapters/d1-fts-dialect';
import { KeywordSearchService } from '@worker/services/keyword-search-service';
import type { DatabaseClient } from '@worker/types/database';
import { describe, expect, it, vi } from 'vitest';

function createMockDb(queryResult: { rows: unknown[] } = { rows: [] }): DatabaseClient {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
    transaction: vi.fn(),
    executeBatch: vi.fn(),
  } as unknown as DatabaseClient;
}

describe('KeywordSearchService', () => {
  it('ranks title matches above content-only matches with title boost', async () => {
    const rows = [
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
    ];

    const mockDb = createMockDb({ rows });
    const service = new KeywordSearchService(mockDb, new D1FtsDialect());

    const results = await service.search('검색 성능');

    expect(results).toHaveLength(2);
    expect(results[0]?.workNote.workId).toBe('WORK-TITLE');
    expect(results[0]?.source).toBe('LEXICAL');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it('falls back to OR query when AND results are insufficient', async () => {
    const mockDb = createMockDb();
    (mockDb.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        rows: [
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
        rows: [
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
      });

    const service = new KeywordSearchService(mockDb, new D1FtsDialect());
    const results = await service.search('검색 성능', { limit: 2 });

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.workNote.workId)).toEqual(
      expect.arrayContaining(['WORK-AND', 'WORK-OR'])
    );

    const calls = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]?.[1]?.[0]).toContain('AND');
    expect(calls[1]?.[1]?.[0]).toContain('OR');
  });

  it('returns empty results for punctuation-only query', async () => {
    const mockDb = createMockDb();
    const service = new KeywordSearchService(mockDb, new D1FtsDialect());
    const results = await service.search(' !!! ((( ))) ::: ');

    expect(results).toEqual([]);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('applies category/person/dept/date filters in candidate query', async () => {
    const mockDb = createMockDb();
    const service = new KeywordSearchService(mockDb, new D1FtsDialect());
    await service.search('검색', {
      category: '운영',
      personId: 'P-001',
      deptName: '개발팀',
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.999Z',
      limit: 5,
    });

    const [sql, params] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];

    expect(sql).toContain('work_note_person wnp');
    expect(sql).toContain('persons p');
    expect(sql).toContain('wn.category = ?');
    expect(sql).toContain('wnp.person_id = ?');
    expect(sql).toContain('p.current_dept = ?');
    expect(sql).toContain('wn.created_at >= ?');
    expect(sql).toContain('wn.created_at <= ?');

    expect(params).toContain('운영');
    expect(params).toContain('P-001');
    expect(params).toContain('개발팀');
    expect(params).toContain('2024-01-01T00:00:00.000Z');
    expect(params).toContain('2024-12-31T23:59:59.999Z');
  });
});
