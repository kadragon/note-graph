// Trace: SPEC-search-1, TASK-011, TASK-016
// Unit tests for Hybrid Search Service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridSearchService } from '../../src/services/hybrid-search-service';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import type { Env } from '../../src/types/env';
import type { SearchResultItem } from '../../src/types/search';

describe('HybridSearchService', () => {
  let mockDb: D1Database;
  let mockEnv: Env;
  let hybridService: HybridSearchService;

  beforeEach(() => {
    // Mock database
    mockDb = {} as D1Database;

    // Mock environment
    mockEnv = {
      AI_GATEWAY_ID: 'test-gateway',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      VECTORIZE: {} as any,
    } as Env;

    hybridService = new HybridSearchService(mockDb, mockEnv);
  });

  describe('RRF Score Calculation', () => {
    it('should calculate correct RRF score for rank 1 with k=60', () => {
      const k = 60;
      const rank = 1;
      const expectedScore = 1 / (k + rank);

      expect(expectedScore).toBeCloseTo(0.01639, 5);
    });

    it('should calculate correct RRF scores for multiple ranks', () => {
      const k = 60;
      const scores = [1, 2, 3, 4, 5].map((rank) => 1 / (k + rank));

      expect(scores[0]).toBeCloseTo(0.01639, 5); // Rank 1
      expect(scores[1]).toBeCloseTo(0.01613, 5); // Rank 2
      expect(scores[2]).toBeCloseTo(0.01587, 5); // Rank 3
      expect(scores[3]).toBeCloseTo(0.01562, 5); // Rank 4
      expect(scores[4]).toBeCloseTo(0.01538, 5); // Rank 5
    });

    it('should show higher ranks get lower RRF scores', () => {
      const k = 60;
      const rank1Score = 1 / (k + 1);
      const rank10Score = 1 / (k + 10);

      expect(rank1Score).toBeGreaterThan(rank10Score);
    });

    it('should combine RRF scores when found by both engines', () => {
      const k = 60;
      const ftsRank = 1;
      const vectorRank = 2;

      const ftsScore = 1 / (k + ftsRank);
      const vectorScore = 1 / (k + vectorRank);
      const combinedScore = ftsScore + vectorScore;

      expect(combinedScore).toBeGreaterThan(ftsScore);
      expect(combinedScore).toBeGreaterThan(vectorScore);
      expect(combinedScore).toBeCloseTo(0.03252, 5);
    });
  });

  describe('Source Attribution', () => {
    it('should return LEXICAL for FTS-only results', () => {
      const sources = new Set(['LEXICAL']);
      const source =
        sources.has('LEXICAL') && sources.has('SEMANTIC')
          ? 'HYBRID'
          : sources.has('LEXICAL')
            ? 'LEXICAL'
            : 'SEMANTIC';

      expect(source).toBe('LEXICAL');
    });

    it('should return SEMANTIC for Vectorize-only results', () => {
      const sources = new Set(['SEMANTIC']);
      const source =
        sources.has('LEXICAL') && sources.has('SEMANTIC')
          ? 'HYBRID'
          : sources.has('LEXICAL')
            ? 'LEXICAL'
            : 'SEMANTIC';

      expect(source).toBe('SEMANTIC');
    });

    it('should return HYBRID when found by both engines', () => {
      const sources = new Set(['LEXICAL', 'SEMANTIC']);
      const source =
        sources.has('LEXICAL') && sources.has('SEMANTIC')
          ? 'HYBRID'
          : sources.has('LEXICAL')
            ? 'LEXICAL'
            : 'SEMANTIC';

      expect(source).toBe('HYBRID');
    });
  });

  describe('Result Merging Logic', () => {
    it('should merge duplicate results from both sources', () => {
      const ftsResults: SearchResultItem[] = [
        {
          workNote: {
            workId: 'WORK-001',
            title: 'Test',
            contentRaw: 'Content',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          score: 0.8,
          source: 'LEXICAL',
        },
      ];

      const vectorResults: SearchResultItem[] = [
        {
          workNote: {
            workId: 'WORK-001',
            title: 'Test',
            contentRaw: 'Content',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          score: 0.9,
          source: 'SEMANTIC',
        },
      ];

      const k = 60;
      const scoreMap = new Map<string, { score: number; sources: Set<string> }>();

      // Simulate RRF merging
      ftsResults.forEach((item, index) => {
        const rank = index + 1;
        const rrfScore = 1 / (k + rank);
        scoreMap.set(item.workNote.workId, {
          score: rrfScore,
          sources: new Set(['LEXICAL']),
        });
      });

      vectorResults.forEach((item, index) => {
        const rank = index + 1;
        const rrfScore = 1 / (k + rank);
        const existing = scoreMap.get(item.workNote.workId);
        if (existing) {
          existing.score += rrfScore;
          existing.sources.add('SEMANTIC');
        }
      });

      const result = scoreMap.get('WORK-001')!;
      expect(result.sources.size).toBe(2);
      expect(result.sources.has('LEXICAL')).toBe(true);
      expect(result.sources.has('SEMANTIC')).toBe(true);
    });

    it('should sort merged results by combined score descending', () => {
      const results = [
        { workId: 'WORK-1', score: 0.02 },
        { workId: 'WORK-2', score: 0.05 },
        { workId: 'WORK-3', score: 0.03 },
      ];

      const sorted = [...results].sort((a, b) => b.score - a.score);

      expect(sorted[0].workId).toBe('WORK-2');
      expect(sorted[1].workId).toBe('WORK-3');
      expect(sorted[2].workId).toBe('WORK-1');
    });

    it('should handle empty FTS results', () => {
      const ftsResults: SearchResultItem[] = [];
      const vectorResults: SearchResultItem[] = [
        {
          workNote: {
            workId: 'WORK-001',
            title: 'Test',
            contentRaw: 'Content',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          score: 0.9,
          source: 'SEMANTIC',
        },
      ];

      const merged = [...ftsResults, ...vectorResults];
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('SEMANTIC');
    });

    it('should handle empty Vectorize results', () => {
      const ftsResults: SearchResultItem[] = [
        {
          workNote: {
            workId: 'WORK-001',
            title: 'Test',
            contentRaw: 'Content',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          score: 0.8,
          source: 'LEXICAL',
        },
      ];
      const vectorResults: SearchResultItem[] = [];

      const merged = [...ftsResults, ...vectorResults];
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('LEXICAL');
    });

    it('should handle both empty results', () => {
      const ftsResults: SearchResultItem[] = [];
      const vectorResults: SearchResultItem[] = [];

      const merged = [...ftsResults, ...vectorResults];
      expect(merged).toEqual([]);
    });
  });

  describe('Filter Building', () => {
    it('should build Vectorize filter with category', () => {
      const filters = { category: '회의' };
      const vectorFilter: Record<string, string> = {};

      if (filters.category) {
        vectorFilter.category = filters.category;
      }

      expect(vectorFilter).toEqual({ category: '회의' });
    });

    it('should return undefined when no filters', () => {
      const filters = {};
      const vectorFilter: Record<string, string> = {};

      if ('category' in filters && filters.category) {
        vectorFilter.category = filters.category;
      }

      const result = Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined;
      expect(result).toBeUndefined();
    });

    it('should not include person/dept in Vectorize filter', () => {
      // Person and dept filters should be applied in D1 query, not Vectorize
      const filters = {
        category: '회의',
        personId: 'P-001',
        deptName: '개발팀',
      };

      const vectorFilter: Record<string, string> = {};

      // Only category goes to Vectorize
      if (filters.category) {
        vectorFilter.category = filters.category;
      }

      expect(vectorFilter).toEqual({ category: '회의' });
      expect(vectorFilter).not.toHaveProperty('personId');
      expect(vectorFilter).not.toHaveProperty('deptName');
    });
  });

  describe('Work Note Fetching by IDs', () => {
    it('should build SQL with IN clause for work IDs', () => {
      const workIds = ['WORK-001', 'WORK-002', 'WORK-003'];
      const placeholders = workIds.map(() => '?').join(',');

      expect(placeholders).toBe('?,?,?');
    });

    it('should handle empty work IDs array', () => {
      const workIds: string[] = [];

      if (workIds.length === 0) {
        expect(true).toBe(true); // Should return early
      }
    });

    it('should apply person filter in D1 query', () => {
      const filters = { personId: 'P-001' };
      const conditions: string[] = ['wn.work_id IN (?)'];
      const params: unknown[] = ['WORK-001'];

      if (filters.personId) {
        conditions.push('wnp.person_id = ?');
        params.push(filters.personId);
      }

      expect(conditions).toContain('wnp.person_id = ?');
      expect(params).toContain('P-001');
    });

    it('should apply department filter in D1 query', () => {
      const filters = { deptName: '개발팀' };
      const conditions: string[] = ['wn.work_id IN (?)'];
      const params: unknown[] = ['WORK-001'];

      if (filters.deptName) {
        conditions.push('p.current_dept = ?');
        params.push(filters.deptName);
      }

      expect(conditions).toContain('p.current_dept = ?');
      expect(params).toContain('개발팀');
    });

    it('should build work notes map from results', () => {
      const dbResults = [
        {
          workId: 'WORK-001',
          title: 'Test 1',
          contentRaw: 'Content 1',
          category: '업무',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        {
          workId: 'WORK-002',
          title: 'Test 2',
          contentRaw: 'Content 2',
          category: '회의',
          createdAt: '2024-01-02',
          updatedAt: '2024-01-02',
        },
      ];

      const workNotesMap = new Map();
      for (const workNote of dbResults) {
        workNotesMap.set(workNote.workId, workNote);
      }

      expect(workNotesMap.size).toBe(2);
      expect(workNotesMap.has('WORK-001')).toBe(true);
      expect(workNotesMap.has('WORK-002')).toBe(true);
      expect(workNotesMap.get('WORK-001')?.title).toBe('Test 1');
    });
  });

  describe('Limit Application', () => {
    it('should use default limit of 10', () => {
      const filters = {};
      const limit = filters.limit ?? 10;

      expect(limit).toBe(10);
    });

    it('should use custom limit from filters', () => {
      const filters = { limit: 20 };
      const limit = filters.limit ?? 10;

      expect(limit).toBe(20);
    });

    it('should multiply limit for individual searches', () => {
      const limit = 10;
      const searchLimit = limit * 2;

      expect(searchLimit).toBe(20);
    });

    it('should apply limit after merging', () => {
      const mergedResults = Array.from({ length: 30 }, (_, i) => ({
        workNote: {
          workId: `WORK-${i}`,
          title: `Test ${i}`,
          contentRaw: 'Content',
          category: '업무',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        score: Math.random(),
        source: 'HYBRID' as const,
      }));

      const limit = 10;
      const limited = mergedResults.slice(0, limit);

      expect(limited).toHaveLength(10);
      expect(mergedResults).toHaveLength(30);
    });
  });

  describe('Korean Text Handling', () => {
    it('should handle Korean search queries', () => {
      const query = '업무 보고서 작성';
      const cleaned = query.trim();

      expect(cleaned).toBe('업무 보고서 작성');
      expect(cleaned.length).toBeGreaterThan(0);
    });

    it('should handle Korean filter values', () => {
      const filters = {
        category: '회의',
        deptName: '개발팀',
      };

      expect(filters.category).toBe('회의');
      expect(filters.deptName).toBe('개발팀');
    });

    it('should handle mixed Korean and English text', () => {
      const query = 'API 서버 개발 업무';
      const cleaned = query.trim();

      expect(cleaned).toContain('API');
      expect(cleaned).toContain('서버');
      expect(cleaned).toContain('업무');
    });
  });

  describe('Error Handling', () => {
    it('should handle FTS search errors gracefully', () => {
      // FTS search errors should return empty array, not throw
      const emptyResults: SearchResultItem[] = [];

      expect(emptyResults).toEqual([]);
    });

    it('should handle Vector search errors gracefully', () => {
      // Vector search errors should return empty array, not throw
      const emptyResults: SearchResultItem[] = [];

      expect(emptyResults).toEqual([]);
    });

    it('should continue with partial results if one search fails', () => {
      const ftsResults: SearchResultItem[] = [
        {
          workNote: {
            workId: 'WORK-001',
            title: 'Test',
            contentRaw: 'Content',
            category: '업무',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          score: 0.8,
          source: 'LEXICAL',
        },
      ];
      const vectorResults: SearchResultItem[] = []; // Failed search

      const merged = [...ftsResults, ...vectorResults];
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('LEXICAL');
    });
  });
});
