// Trace: SPEC-search-1, TASK-011, TASK-016, spec_id=SPEC-testing-migration-001, task_id=TASK-TYPE-SAFE-MOCKS
// Unit tests for Hybrid Search Service - Public API Testing (Jest version)

import type { D1Database, D1Result } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  asD1Database,
  asVectorizeIndex,
  createMockD1Database,
  createMockFetch,
  createMockVectorizeIndex,
  type MockD1Database,
  type MockVectorizeIndex,
} from '@test-helpers/mock-helpers';
import { HybridSearchService } from '@worker/services/hybrid-search-service';
import type { Env } from '@worker/types/env';

type D1ResultType<T> = D1Result<T>;

/**
 * These tests focus on the public API of HybridSearchService.
 * We test the search() method's behavior with different inputs and conditions,
 * treating the service as a black box and verifying outputs and side effects.
 */
describe('HybridSearchService - Public API', () => {
  let mockDb: MockD1Database;
  let mockEnv: Env;
  let mockVectorize: MockVectorizeIndex;

  beforeEach(() => {
    // Setup type-safe mock database
    mockDb = createMockD1Database();

    // Setup type-safe mock Vectorize
    mockVectorize = createMockVectorizeIndex({
      query: jest.fn<(vector: number[], options?: any) => Promise<any>>().mockResolvedValue({
        matches: [],
        count: 0,
      }),
    });

    // Setup mock environment
    mockEnv = {
      AI_GATEWAY_ID: 'test-gateway',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      VECTORIZE: asVectorizeIndex(mockVectorize),
    } as unknown as Env;

    // Mock global fetch for OpenAI embedding calls
    global.fetch = createMockFetch({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
      }),
    }) as unknown as typeof fetch;
  });

  describe('search() method', () => {
    it('should accept query string and return array of results', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Act
      const results = await service.search('test query');

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty query results gracefully', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);
      mockDb.prepare('').all.mockResolvedValue({
        success: true,
        results: [],
      } as unknown as D1Result);
      mockVectorize.query.mockResolvedValue({
        matches: [],
        count: 0,
      });

      // Act
      const results = await service.search('nonexistent term');

      // Assert
      expect(results).toEqual([]);
    });

    it('should accept and apply filter parameters', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);
      const filters = {
        category: '회의',
        personId: '123456',
        limit: 20,
      };

      // Act
      await service.search('test', filters);

      // Assert - verify DB was called (FTS search happens)
      expect(mockDb.prepare).toHaveBeenCalled();
      // Verify filters were used in SQL query
      const sqlCalls = (mockDb.prepare as jest.Mock).mock.calls;
      const sqlQuery = sqlCalls[0][0] as string;
      expect(sqlQuery).toContain('WHERE');
    });

    it('should respect limit parameter and not exceed it', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Mock FTS results with more items than limit
      const manyResults = Array.from({ length: 30 }, (_, i) => ({
        workId: `WORK-${i.toString().padStart(3, '0')}`,
        title: `Result ${i}`,
        contentRaw: `Content ${i}`,
        category: '업무',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        fts_rank: -1,
      }));

      mockDb.prepare('').all.mockResolvedValue({
        success: true,
        results: manyResults,
      } as unknown as D1Result);

      // Act
      const results = await service.search('test', { limit: 10 });

      // Assert
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should handle Korean text in queries', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Act
      const results = await service.search('한글 검색 테스트');

      // Assert - should complete without errors
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results with required fields', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Mock at least one result from FTS
      mockDb.prepare('').all.mockResolvedValue({
        success: true,
        results: [
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
      } as unknown as D1Result);

      // Act
      const results = await service.search('test');

      // Assert
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
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);
      mockDb.prepare('').all.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert - should not throw, should return empty or handle gracefully
      await expect(service.search('test')).resolves.toBeDefined();
    });

    it('should handle Vectorize errors without crashing', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);
      mockVectorize.query.mockRejectedValue(new Error('Vectorize service down'));

      // Mock FTS to return results
      mockDb.prepare('').all.mockResolvedValue({
        success: true,
        results: [
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
      } as unknown as D1Result);

      // Act
      const results = await service.search('test');

      // Assert - should still return FTS results
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should call both FTS and Vectorize for search', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Act
      await service.search('test query');

      // Assert - verify both search methods were attempted
      expect(mockDb.prepare).toHaveBeenCalled(); // FTS
      expect(global.fetch).toHaveBeenCalled(); // OpenAI embedding for Vectorize
    });
  });

  describe('Result Quality', () => {
    it('should return results sorted by score in descending order', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Mock multiple FTS results with different ranks
      mockDb.prepare('').all.mockResolvedValue({
        success: true,
        results: [
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
      } as unknown as D1Result);

      // Act
      const results = await service.search('test');

      // Assert - scores should be in descending order
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it('should normalize scores to reasonable range', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      mockDb.prepare('').all.mockResolvedValue({
        success: true,
        results: [
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
      } as unknown as D1Result);

      // Act
      const results = await service.search('test');

      // Assert - scores should be reasonable
      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThanOrEqual(0);
        expect(results[0].score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Filter Application', () => {
    it('should construct appropriate SQL for category filter', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Act
      await service.search('test', { category: '회의' });

      // Assert
      expect(mockDb.prepare).toHaveBeenCalled();
      const sqlCalls = (mockDb.prepare as jest.Mock).mock.calls;
      const sqlQuery = sqlCalls[0][0] as string;
      expect(sqlQuery).toContain('category');
    });

    it('should construct appropriate SQL for person filter', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Act
      await service.search('test', { personId: '123456' });

      // Assert
      expect(mockDb.prepare).toHaveBeenCalled();
      const sqlCalls = (mockDb.prepare as jest.Mock).mock.calls;
      const sqlQuery = sqlCalls[0][0] as string;
      expect(sqlQuery).toContain('person');
    });

    it('should construct appropriate SQL for department filter', async () => {
      // Arrange
      const service = new HybridSearchService(asD1Database(mockDb), mockEnv);

      // Act
      await service.search('test', { deptName: '개발팀' });

      // Assert
      expect(mockDb.prepare).toHaveBeenCalled();
      const sqlCalls = (mockDb.prepare as jest.Mock).mock.calls;
      const sqlQuery = sqlCalls[0][0] as string;
      expect(sqlQuery).toContain('dept');
    });
  });
});
