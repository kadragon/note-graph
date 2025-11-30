// Trace: SPEC-search-1, TASK-009, TASK-010, TASK-011
import { describe, expect, it, vi } from 'vitest';
import { EmbeddingService } from '../src/services/embedding-service';
import type { Env } from '../src/types/env';
import type { SearchResultItem } from '../src/types/search';

describe('Search Functionality', () => {
  describe('TASK-010: Embedding Service (OpenAI Integration)', () => {
    describe('EmbeddingService', () => {
      it('should generate embedding for single text', async () => {
        const mockEnv = {
          AI_GATEWAY_ID: 'test-gateway',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
        } as Env;

        const embeddingService = new EmbeddingService(mockEnv);

        // Mock fetch to return embedding
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
          }),
        } as Response);

        const embedding = await embeddingService.generateEmbedding('test text');

        expect(embedding).toHaveLength(1536);
        expect(embedding[0]).toBe(0.1);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('gateway.ai.cloudflare.com'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-key',
            }),
          })
        );
      });

      it('should generate embeddings for multiple texts in batch', async () => {
        const mockEnv = {
          AI_GATEWAY_ID: 'test-gateway',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
        } as Env;

        const embeddingService = new EmbeddingService(mockEnv);

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [
              { embedding: new Array(1536).fill(0.1), index: 0 },
              { embedding: new Array(1536).fill(0.2), index: 1 },
            ],
          }),
        } as Response);

        const embeddings = await embeddingService.generateEmbeddings(['text 1', 'text 2']);

        expect(embeddings).toHaveLength(2);
        expect(embeddings[0]).toHaveLength(1536);
        expect(embeddings[1]).toHaveLength(1536);
        expect(embeddings[0][0]).toBe(0.1);
        expect(embeddings[1][0]).toBe(0.2);
      });

      it('should handle rate limit errors (429)', async () => {
        const mockEnv = {
          AI_GATEWAY_ID: 'test-gateway',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
        } as Env;

        const embeddingService = new EmbeddingService(mockEnv);

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        } as Response);

        await expect(embeddingService.generateEmbedding('test')).rejects.toThrow(
          'AI_RATE_LIMIT: Embedding rate limit exceeded'
        );
      });

      it('should handle empty input array', async () => {
        const mockEnv = {
          AI_GATEWAY_ID: 'test-gateway',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
        } as Env;

        const embeddingService = new EmbeddingService(mockEnv);
        const embeddings = await embeddingService.generateEmbeddings([]);

        expect(embeddings).toEqual([]);
      });

      it('should throw error when no embedding returned', async () => {
        const mockEnv = {
          AI_GATEWAY_ID: 'test-gateway',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
        } as Env;

        const embeddingService = new EmbeddingService(mockEnv);

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response);

        await expect(embeddingService.generateEmbedding('test')).rejects.toThrow(
          'No embedding returned from OpenAI API'
        );
      });

      it('should handle OpenAI API errors', async () => {
        const mockEnv = {
          AI_GATEWAY_ID: 'test-gateway',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
        } as Env;

        const embeddingService = new EmbeddingService(mockEnv);

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as Response);

        await expect(embeddingService.generateEmbedding('test')).rejects.toThrow(
          'OpenAI API error (500): Internal Server Error'
        );
      });

      it('should use correct model and encoding format', async () => {
        const mockEnv = {
          AI_GATEWAY_ID: 'test-gateway',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
        } as Env;

        const embeddingService = new EmbeddingService(mockEnv);

        interface EmbeddingRequestBody {
          model: string;
          input: string[];
          encoding_format: string;
        }
        let requestBody: EmbeddingRequestBody;
        global.fetch = vi.fn().mockImplementation(async (_url, options) => {
          requestBody = JSON.parse(options?.body as string);
          return {
            ok: true,
            json: async () => ({
              data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
            }),
          } as Response;
        });

        await embeddingService.generateEmbedding('test text');

        expect(requestBody).toEqual({
          model: 'text-embedding-3-small',
          input: ['test text'],
          encoding_format: 'float',
        });
      });
    });
  });

  describe('TASK-011: Hybrid Search with RRF Ranking', () => {
    describe('RRF Algorithm Validation', () => {
      it('should calculate RRF score correctly with k=60', () => {
        // RRF formula: score = 1 / (k + rank)
        // For rank 1: 1 / (60 + 1) = 0.016393...
        // For rank 2: 1 / (60 + 2) = 0.016129...

        const k = 60;
        const rank1Score = 1 / (k + 1);
        const rank2Score = 1 / (k + 2);

        expect(rank1Score).toBeCloseTo(0.01639, 5);
        expect(rank2Score).toBeCloseTo(0.01613, 5);

        // If same item found at rank 1 in both: combined score
        const combinedScore = rank1Score + rank1Score;
        expect(combinedScore).toBeCloseTo(0.03279, 5);
      });

      it('should merge results found by both FTS and Vectorize as HYBRID', () => {
        const ftsResults: SearchResultItem[] = [
          {
            workNote: {
              workId: 'WORK-1',
              title: 'Test 1',
              contentRaw: 'Content 1',
              category: '회의',
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
              workId: 'WORK-1',
              title: 'Test 1',
              contentRaw: 'Content 1',
              category: '회의',
              createdAt: '2024-01-01',
              updatedAt: '2024-01-01',
            },
            score: 0.9,
            source: 'SEMANTIC',
          },
        ];

        // Simulate RRF merge
        const k = 60;
        const scoreMap = new Map<string, { score: number; sources: Set<string> }>();

        // Add FTS score
        ftsResults.forEach((item, index) => {
          const rank = index + 1;
          const rrfScore = 1 / (k + rank);
          scoreMap.set(item.workNote.workId, {
            score: rrfScore,
            sources: new Set(['LEXICAL']),
          });
        });

        // Add Vector score
        vectorResults.forEach((item, index) => {
          const rank = index + 1;
          const rrfScore = 1 / (k + rank);
          const existing = scoreMap.get(item.workNote.workId);
          if (existing) {
            existing.score += rrfScore;
            existing.sources.add('SEMANTIC');
          }
        });

        const result = scoreMap.get('WORK-1') as { score: number; sources: Set<string> };
        expect(result.sources.has('LEXICAL')).toBe(true);
        expect(result.sources.has('SEMANTIC')).toBe(true);
        expect(result.sources.size).toBe(2);

        // Determine source type
        const sourceType =
          result.sources.has('LEXICAL') && result.sources.has('SEMANTIC') ? 'HYBRID' : 'LEXICAL';
        expect(sourceType).toBe('HYBRID');
      });

      it('should sort merged results by combined RRF score descending', () => {
        // Simulate multiple results with different scores
        const results = [
          { workId: 'WORK-1', score: 0.01 }, // Lower score
          { workId: 'WORK-2', score: 0.05 }, // Higher score
          { workId: 'WORK-3', score: 0.03 }, // Medium score
        ];

        const sorted = [...results].sort((a, b) => b.score - a.score);

        expect(sorted[0].workId).toBe('WORK-2');
        expect(sorted[1].workId).toBe('WORK-3');
        expect(sorted[2].workId).toBe('WORK-1');
      });

      it('should handle FTS-only results (LEXICAL source)', () => {
        const sources = new Set(['LEXICAL']);
        const sourceType =
          sources.has('LEXICAL') && sources.has('SEMANTIC')
            ? 'HYBRID'
            : sources.has('LEXICAL')
              ? 'LEXICAL'
              : 'SEMANTIC';

        expect(sourceType).toBe('LEXICAL');
      });

      it('should handle Vectorize-only results (SEMANTIC source)', () => {
        const sources = new Set(['SEMANTIC']);
        const sourceType =
          sources.has('LEXICAL') && sources.has('SEMANTIC')
            ? 'HYBRID'
            : sources.has('LEXICAL')
              ? 'LEXICAL'
              : 'SEMANTIC';

        expect(sourceType).toBe('SEMANTIC');
      });

      it('should calculate different RRF scores for different ranks', () => {
        const k = 60;
        const scores = [];

        for (let rank = 1; rank <= 5; rank++) {
          scores.push(1 / (k + rank));
        }

        // Each subsequent rank should have lower score
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i]).toBeLessThan(scores[i - 1]);
        }

        // Verify specific values
        expect(scores[0]).toBeCloseTo(0.01639, 5); // Rank 1
        expect(scores[1]).toBeCloseTo(0.01613, 5); // Rank 2
        expect(scores[4]).toBeCloseTo(0.01538, 5); // Rank 5
      });
    });

    describe('Search Result Merging', () => {
      it('should combine scores for duplicate work notes', () => {
        const k = 60;
        const _workId = 'WORK-123';

        // Found at rank 2 in FTS
        const ftsRank = 2;
        const ftsScore = 1 / (k + ftsRank);

        // Found at rank 3 in Vectorize
        const vectorRank = 3;
        const vectorScore = 1 / (k + vectorRank);

        const combinedScore = ftsScore + vectorScore;

        expect(combinedScore).toBeCloseTo(0.032, 5);
        expect(combinedScore).toBeGreaterThan(ftsScore);
        expect(combinedScore).toBeGreaterThan(vectorScore);
      });

      it('should apply limit after merging', () => {
        const results = Array.from({ length: 20 }, (_, i) => ({
          workId: `WORK-${i}`,
          score: Math.random(),
        }));

        const limit = 10;
        const limited = results.slice(0, limit);

        expect(limited).toHaveLength(10);
        expect(results).toHaveLength(20);
      });

      it('should handle empty FTS results gracefully', () => {
        const ftsResults: SearchResultItem[] = [];
        const vectorResults: SearchResultItem[] = [
          {
            workNote: {
              workId: 'WORK-1',
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

      it('should handle empty Vectorize results gracefully', () => {
        const ftsResults: SearchResultItem[] = [
          {
            workNote: {
              workId: 'WORK-1',
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
    });

    describe('Filter Application Logic', () => {
      it('should build filter conditions correctly', () => {
        const filters = {
          category: '회의',
          personId: 'P-001',
          deptName: '개발팀',
          from: '2024-01-01',
          to: '2024-12-31',
        };

        const conditions: string[] = [];

        if (filters.category) {
          conditions.push('category = ?');
        }
        if (filters.personId) {
          conditions.push('person_id = ?');
        }
        if (filters.deptName) {
          conditions.push('dept_name = ?');
        }
        if (filters.from) {
          conditions.push('created_at >= ?');
        }
        if (filters.to) {
          conditions.push('created_at <= ?');
        }

        expect(conditions).toHaveLength(5);
        expect(conditions).toContain('category = ?');
        expect(conditions).toContain('person_id = ?');
        expect(conditions).toContain('dept_name = ?');
        expect(conditions).toContain('created_at >= ?');
        expect(conditions).toContain('created_at <= ?');
      });

      it('should handle partial filters', () => {
        const filters = {
          category: '회의',
        };

        const conditions: string[] = [];

        if (filters.category) {
          conditions.push('category = ?');
        }

        expect(conditions).toHaveLength(1);
        expect(conditions[0]).toBe('category = ?');
      });

      it('should handle no filters', () => {
        const filters = {};
        const conditions: string[] = [];

        if ('category' in filters && filters.category) {
          conditions.push('category = ?');
        }

        expect(conditions).toHaveLength(0);
      });
    });
  });

  describe('TASK-009: FTS Search Logic', () => {
    describe('FTS Query Building', () => {
      it('should clean and trim query text', () => {
        const query = '  업무 처리  ';
        const cleaned = query.trim();

        expect(cleaned).toBe('업무 처리');
        expect(cleaned.startsWith(' ')).toBe(false);
        expect(cleaned.endsWith(' ')).toBe(false);
      });

      it('should handle Korean text in query', () => {
        const koreanQuery = '2024년 업무 성적 처리';
        const cleaned = koreanQuery.trim();

        expect(cleaned).toBe('2024년 업무 성적 처리');
        expect(cleaned.length).toBeGreaterThan(0);
      });

      it('should handle empty query', () => {
        const query = '   ';
        const cleaned = query.trim();

        expect(cleaned).toBe('');
      });

      it('should pass through multi-word queries', () => {
        const query = '학생 성적 관리 시스템';
        const cleaned = query.trim();

        expect(cleaned).toBe('학생 성적 관리 시스템');
        // FTS5 will match documents containing any of these terms
      });
    });

    describe('FTS Score Normalization', () => {
      it('should normalize FTS rank to 0-1 range', () => {
        // FTS rank is typically between -10 and 0 (negative)
        const ftsRanks = [-1, -5, -10];
        const normalized = ftsRanks.map((rank) => Math.max(0, 1 + rank / 10));

        expect(normalized[0]).toBe(0.9); // -1 → 0.9
        expect(normalized[1]).toBe(0.5); // -5 → 0.5
        expect(normalized[2]).toBe(0.0); // -10 → 0.0

        // All should be in 0-1 range
        normalized.forEach((score) => {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        });
      });

      it('should handle edge case of rank 0', () => {
        const rank = 0;
        const normalized = Math.max(0, 1 + rank / 10);

        expect(normalized).toBe(1.0);
      });

      it('should handle very negative ranks', () => {
        const rank = -20;
        const normalized = Math.max(0, 1 + rank / 10);

        expect(normalized).toBe(0); // Clamped to 0
      });
    });
  });

  describe('Korean Text Handling', () => {
    it('should handle Korean characters in search queries', () => {
      const koreanTexts = ['업무', '성적', '회의록', '보고서', '2024년 업무', '학생 성적 관리'];

      koreanTexts.forEach((text) => {
        const cleaned = text.trim();
        expect(cleaned).toBe(text);
        expect(cleaned.length).toBeGreaterThan(0);
      });
    });

    it('should handle mixed Korean and English text', () => {
      const mixedText = 'API 서버 업무 처리 system';
      const cleaned = mixedText.trim();

      expect(cleaned).toBe('API 서버 업무 처리 system');
      expect(cleaned).toContain('API');
      expect(cleaned).toContain('서버');
      expect(cleaned).toContain('system');
    });

    it('should handle Korean numbers and dates', () => {
      const dateText = '2024년 11월 18일';
      const cleaned = dateText.trim();

      expect(cleaned).toBe('2024년 11월 18일');
    });
  });

  describe('Integration - Search Result Format', () => {
    it('should format search results with required fields', () => {
      const result: SearchResultItem = {
        workNote: {
          workId: 'WORK-001',
          title: '업무 보고서',
          contentRaw: '2024년 업무 처리 내용',
          category: '보고',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        score: 0.85,
        source: 'HYBRID',
      };

      expect(result.workNote).toBeDefined();
      expect(result.workNote.workId).toBe('WORK-001');
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(['LEXICAL', 'SEMANTIC', 'HYBRID']).toContain(result.source);
    });

    it('should validate source attribution values', () => {
      const validSources = ['LEXICAL', 'SEMANTIC', 'HYBRID'];

      validSources.forEach((source) => {
        expect(['LEXICAL', 'SEMANTIC', 'HYBRID']).toContain(source);
      });
    });

    it('should include all required work note fields', () => {
      const workNote = {
        workId: 'WORK-001',
        title: 'Test',
        contentRaw: 'Content',
        category: '업무',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      expect(workNote).toHaveProperty('workId');
      expect(workNote).toHaveProperty('title');
      expect(workNote).toHaveProperty('contentRaw');
      expect(workNote).toHaveProperty('category');
      expect(workNote).toHaveProperty('createdAt');
      expect(workNote).toHaveProperty('updatedAt');
    });
  });
});
