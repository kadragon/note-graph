// Trace: SPEC-performance - Embedding processor batch fetch optimization
// Tests that reindexAll uses batch fetching instead of N+1 queries

import { env } from 'cloudflare:test';
import { EmbeddingProcessor } from '@worker/services/embedding-processor';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface TestEmbeddingProcessor extends EmbeddingProcessor {
  repository: {
    findByIdWithDetails: ReturnType<typeof vi.fn>;
    findByIdsWithDetails: ReturnType<typeof vi.fn>;
    getDeptNameForPerson: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    updateEmbeddedAt: ReturnType<typeof vi.fn>;
  };
  upsertChunks: ReturnType<typeof vi.fn>;
  deleteStaleChunks: ReturnType<typeof vi.fn>;
}

describe('EmbeddingProcessor - batch fetch optimization', () => {
  const baseEnv = env as unknown as Env;
  let processor: EmbeddingProcessor;
  // Save original DB reference to restore after tests that mock it
  let originalDB: typeof baseEnv.DB;

  beforeEach(() => {
    originalDB = baseEnv.DB;
    processor = new EmbeddingProcessor(baseEnv);

    // Mock repository methods
    (processor as TestEmbeddingProcessor).repository = {
      findByIdWithDetails: vi.fn(),
      findByIdsWithDetails: vi.fn(),
      getDeptNameForPerson: vi.fn(),
      getVersions: vi.fn().mockResolvedValue([]),
      updateEmbeddedAt: vi.fn().mockResolvedValue(undefined),
    };

    // Mock embedding/vectorize operations
    (processor as TestEmbeddingProcessor).upsertChunks = vi.fn().mockResolvedValue(undefined);
    (processor as TestEmbeddingProcessor).deleteStaleChunks = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original DB to prevent test pollution
    if (originalDB) {
      (baseEnv as { DB: typeof originalDB }).DB = originalDB;
    }
  });

  it('reindexAll uses batch fetch instead of N+1 individual fetches', async () => {
    // Arrange: 3 work notes to reindex
    const mockWorkNotes = [
      { workId: 'WORK-A', title: 'Note A', contentRaw: 'Content A', createdAt: '2024-01-01' },
      { workId: 'WORK-B', title: 'Note B', contentRaw: 'Content B', createdAt: '2024-01-02' },
      { workId: 'WORK-C', title: 'Note C', contentRaw: 'Content C', createdAt: '2024-01-03' },
    ];

    // Mock D1 queries for count and fetching work notes
    const mockDB = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ count: 3 }),
      all: vi.fn().mockResolvedValue({ results: mockWorkNotes }),
    };
    (processor as unknown as { env: { DB: typeof mockDB } }).env.DB = mockDB;

    // Mock batch fetch - should be called once with all 3 work IDs
    const mockDetailsMap = new Map([
      [
        'WORK-A',
        {
          workId: 'WORK-A',
          title: 'Note A',
          contentRaw: 'Content A',
          createdAt: '2024-01-01',
          persons: [{ personId: 'P1', currentDept: 'Dept A' }],
          relatedWorkNotes: [],
          categories: [],
        },
      ],
      [
        'WORK-B',
        {
          workId: 'WORK-B',
          title: 'Note B',
          contentRaw: 'Content B',
          createdAt: '2024-01-02',
          persons: [{ personId: 'P2', currentDept: 'Dept B' }],
          relatedWorkNotes: [],
          categories: [],
        },
      ],
      [
        'WORK-C',
        {
          workId: 'WORK-C',
          title: 'Note C',
          contentRaw: 'Content C',
          createdAt: '2024-01-03',
          persons: [],
          relatedWorkNotes: [],
          categories: [],
        },
      ],
    ]);
    (processor as TestEmbeddingProcessor).repository.findByIdsWithDetails.mockResolvedValue(
      mockDetailsMap
    );

    // Act
    await processor.reindexAll(10);

    // Assert: findByIdsWithDetails called once with all work IDs (batch fetch)
    expect(
      (processor as TestEmbeddingProcessor).repository.findByIdsWithDetails
    ).toHaveBeenCalledTimes(1);
    expect(
      (processor as TestEmbeddingProcessor).repository.findByIdsWithDetails
    ).toHaveBeenCalledWith(['WORK-A', 'WORK-B', 'WORK-C']);

    // Assert: findByIdWithDetails (individual fetch) should NOT be called
    expect(
      (processor as TestEmbeddingProcessor).repository.findByIdWithDetails
    ).not.toHaveBeenCalled();

    // Assert: getDeptNameForPerson (individual fetch) should NOT be called
    expect(
      (processor as TestEmbeddingProcessor).repository.getDeptNameForPerson
    ).not.toHaveBeenCalled();
  });

  it('processBatch updates all work notes in parallel via Promise.allSettled', async () => {
    vi.useFakeTimers();
    try {
      // Arrange: Track timing to verify parallel execution
      const callOrder: string[] = [];
      const delays = { 'WORK-A': 50, 'WORK-B': 30, 'WORK-C': 10 };

      // Mock deleteStaleChunks with varying delays
      (processor as TestEmbeddingProcessor).deleteStaleChunks = vi
        .fn()
        .mockImplementation(async (workId: string) => {
          await new Promise((resolve) =>
            setTimeout(resolve, delays[workId as keyof typeof delays] || 0)
          );
          callOrder.push(`delete-${workId}`);
        });

      // Mock updateEmbeddedAt with immediate resolution
      (processor as TestEmbeddingProcessor).repository.updateEmbeddedAt = vi
        .fn()
        .mockImplementation(async (workId: string) => {
          callOrder.push(`update-${workId}`);
        });

      // Create a chunk map for 3 work notes
      const workNoteChunkMap = new Map<string, string[]>([
        ['WORK-A', ['WORK-A#chunk0']],
        ['WORK-B', ['WORK-B#chunk0']],
        ['WORK-C', ['WORK-C#chunk0']],
      ]);

      const chunks = [
        {
          id: 'WORK-A#chunk0',
          text: 'Content A',
          metadata: {
            work_id: 'WORK-A',
            scope: 'WORK',
            chunk_index: 0,
            created_at_bucket: '2024-01-01',
          },
          workId: 'WORK-A',
        },
        {
          id: 'WORK-B#chunk0',
          text: 'Content B',
          metadata: {
            work_id: 'WORK-B',
            scope: 'WORK',
            chunk_index: 0,
            created_at_bucket: '2024-01-02',
          },
          workId: 'WORK-B',
        },
        {
          id: 'WORK-C#chunk0',
          text: 'Content C',
          metadata: {
            work_id: 'WORK-C',
            scope: 'WORK',
            chunk_index: 0,
            created_at_bucket: '2024-01-03',
          },
          workId: 'WORK-C',
        },
      ];

      // Act - call processBatch directly
      const processBatch = (
        processor as unknown as {
          processBatch: (typeof processor)['processBatch' & keyof typeof processor];
        }
      ).processBatch.bind(processor);
      const resultPromise = processBatch(chunks, workNoteChunkMap);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert: All work notes processed
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);

      // Assert: All deleteStaleChunks called
      expect((processor as TestEmbeddingProcessor).deleteStaleChunks).toHaveBeenCalledTimes(3);

      // Assert: All updateEmbeddedAt called
      expect(
        (processor as TestEmbeddingProcessor).repository.updateEmbeddedAt
      ).toHaveBeenCalledTimes(3);

      // Assert: If parallel, WORK-C (shortest delay) should complete first
      // In sequential mode: order would be A, B, C
      // In parallel mode: order should be C, B, A (by delay time)
      const deleteOrder = callOrder.filter((c) => c.startsWith('delete-'));
      expect(deleteOrder).toEqual(['delete-WORK-C', 'delete-WORK-B', 'delete-WORK-A']);
    } finally {
      vi.useRealTimers();
    }
  });
});
