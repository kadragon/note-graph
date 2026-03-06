// Trace: SPEC-search-1, TASK-011, TASK-016
// Unit tests for Hybrid Search Service - Public API Testing

import { PostgresFtsDialect } from '@worker/adapters/postgres-fts-dialect';
import { HybridSearchService } from '@worker/services/hybrid-search-service';
import type { DatabaseClient } from '@worker/types/database';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockVectorizeIndex {
  query: ReturnType<typeof vi.fn>;
}

function createMockDb(queryResult: { rows: unknown[] } = { rows: [] }): DatabaseClient {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
    transaction: vi.fn(),
    executeBatch: vi.fn(),
  } as unknown as DatabaseClient;
}

/**
 * These tests focus on the public API of HybridSearchService.
 * We test the search() method's behavior with different inputs and conditions,
 * treating the service as a black box and verifying outputs and side effects.
 */
describe('HybridSearchService - Public API', () => {
  let mockDb: DatabaseClient;
  let mockEnv: Env;

  beforeEach(() => {
    mockDb = createMockDb();

    // Setup mock environment
    mockEnv = {
      AI_GATEWAY_ID: 'test-gateway',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      VECTORIZE: {
        query: vi.fn().mockResolvedValue({
          matches: [],
          count: 0,
        }),
      } as unknown as MockVectorizeIndex,
    } as Env;

    // Mock global fetch for OpenAI embedding calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
      }),
    } as Response);
  });

  describe('search() method', () => {
    it('should accept query string and return array of results', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      const results = await service.search('test query');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty query results gracefully', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      const results = await service.search('nonexistent term');
      expect(results).toEqual([]);
    });

    it('should accept and apply filter parameters', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      const filters = {
        category: '회의',
        personId: '123456',
        limit: 20,
      };

      await service.search('test', filters);

      expect(mockDb.query).toHaveBeenCalled();
      const [sql] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('WHERE');
    });

    it('should respect limit parameter and not exceed it', async () => {
      const manyResults = Array.from({ length: 30 }, (_, i) => ({
        workId: `WORK-${i.toString().padStart(3, '0')}`,
        title: `Result ${i}`,
        contentRaw: `Content ${i}`,
        category: '업무',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        fts_rank: -1,
      }));

      mockDb = createMockDb({ rows: manyResults });
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());

      const results = await service.search('test', { limit: 10 });
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should handle Korean text in queries', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      const results = await service.search('한글 검색 테스트');
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results with required fields', async () => {
      mockDb = createMockDb({
        rows: [
          {
            workId: 'WORK-001',
            title: 'Test Result',
            contentRaw: 'Test Content',
            category: '업무',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            fts_rank: -1.5,
          },
        ],
      });
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());

      const results = await service.search('test');

      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty('workNote');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('source');
        expect(result.workNote).toHaveProperty('workId');
        expect(result.workNote).toHaveProperty('title');
        expect(result.workNote).toHaveProperty('contentRaw');
        expect(typeof result.score).toBe('number');
        expect(['LEXICAL', 'SEMANTIC', 'HYBRID']).toContain(result.source);
      }
    });

    it('should handle database errors without crashing', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());

      await expect(service.search('test')).resolves.toBeDefined();
    });

    it('should handle Vectorize errors without crashing', async () => {
      mockDb = createMockDb({
        rows: [
          {
            workId: 'WORK-001',
            title: 'FTS Result',
            contentRaw: 'Content',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            fts_rank: -1,
          },
        ],
      });
      (mockEnv.VECTORIZE as unknown as MockVectorizeIndex).query.mockRejectedValue(
        new Error('Vectorize service down')
      );

      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      const results = await service.search('test');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should call both FTS and Vectorize for search', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      await service.search('test query');

      expect(mockDb.query).toHaveBeenCalled(); // FTS
      expect(global.fetch).toHaveBeenCalled(); // OpenAI embedding for Vectorize
    });
  });

  describe('Result Quality', () => {
    it('should return results sorted by score in descending order', async () => {
      mockDb = createMockDb({
        rows: [
          {
            workId: 'WORK-001',
            title: 'Result 1',
            contentRaw: 'Content 1',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            fts_rank: -5,
          },
          {
            workId: 'WORK-002',
            title: 'Result 2',
            contentRaw: 'Content 2',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            fts_rank: -1,
          },
          {
            workId: 'WORK-003',
            title: 'Result 3',
            contentRaw: 'Content 3',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            fts_rank: -3,
          },
        ],
      });
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      const results = await service.search('test');

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it('should normalize scores to reasonable range', async () => {
      mockDb = createMockDb({
        rows: [
          {
            workId: 'WORK-001',
            title: 'Result',
            contentRaw: 'Content',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            fts_rank: -2,
          },
        ],
      });
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      const results = await service.search('test');

      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThanOrEqual(0);
        expect(results[0].score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Filter Application', () => {
    it('should construct appropriate SQL for category filter', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      await service.search('test', { category: '회의' });

      expect(mockDb.query).toHaveBeenCalled();
      const [sql] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('category');
    });

    it('should construct appropriate SQL for person filter', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      await service.search('test', { personId: '123456' });

      expect(mockDb.query).toHaveBeenCalled();
      const [sql] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('person');
    });

    it('should construct appropriate SQL for department filter', async () => {
      const service = new HybridSearchService(mockDb, mockEnv, new PostgresFtsDialect());
      await service.search('test', { deptName: '개발팀' });

      expect(mockDb.query).toHaveBeenCalled();
      const [sql] = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('dept');
    });
  });
});
