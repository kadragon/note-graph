// Trace: SPEC-performance - Embedding processor batch fetch optimization
// Tests that reindexAll uses batch fetching instead of N+1 queries

import { EmbeddingProcessor } from '@worker/services/embedding-processor';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testPgDb } from '../pg-setup';

const mockEnv = {
  OPENAI_API_KEY: 'test-key',
  OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
  OPENAI_MODEL_CHAT: 'gpt-4.5-turbo',
  OPENAI_MODEL_LIGHTWEIGHT: 'gpt-5-mini',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  AI_GATEWAY_ID: 'test-gateway',
  AI_GATEWAY_BASE_URL: 'https://gateway.ai.cloudflare.com',
  ENVIRONMENT: 'test',
  VECTORIZE: { upsert: vi.fn(), query: vi.fn(), deleteByIds: vi.fn() },
} as unknown as Env;

interface TestEmbeddingProcessor extends EmbeddingProcessor {
  repository: {
    findByIdWithDetails: ReturnType<typeof vi.fn>;
    findByIdsWithDetails: ReturnType<typeof vi.fn>;
    findTodosByWorkIds: ReturnType<typeof vi.fn>;
    getDeptNameForPerson: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    updateEmbeddedAt: ReturnType<typeof vi.fn>;
    updateEmbeddedAtIfUpdatedAtMatches: ReturnType<typeof vi.fn>;
  };
  upsertChunks: ReturnType<typeof vi.fn>;
  deleteStaleChunks: ReturnType<typeof vi.fn>;
}

describe('EmbeddingProcessor - batch fetch optimization', () => {
  let processor: EmbeddingProcessor;

  beforeEach(() => {
    processor = new EmbeddingProcessor(testPgDb, mockEnv);

    // Mock repository methods
    (processor as TestEmbeddingProcessor).repository = {
      findByIdWithDetails: vi.fn(),
      findByIdsWithDetails: vi.fn(),
      findTodosByWorkIds: vi.fn().mockResolvedValue(new Map()),
      getDeptNameForPerson: vi.fn(),
      getVersions: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      updateEmbeddedAt: vi.fn().mockResolvedValue(undefined),
      updateEmbeddedAtIfUpdatedAtMatches: vi.fn().mockResolvedValue(true),
    };

    // Mock embedding/vectorize operations
    (processor as TestEmbeddingProcessor).upsertChunks = vi.fn().mockResolvedValue(undefined);
    (processor as TestEmbeddingProcessor).deleteStaleChunks = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reindexAll uses batch fetch instead of N+1 individual fetches', async () => {
    // Arrange: 3 work notes to reindex
    const mockWorkNotes = [
      { workId: 'WORK-A', title: 'Note A', contentRaw: 'Content A', createdAt: '2024-01-01' },
      { workId: 'WORK-B', title: 'Note B', contentRaw: 'Content B', createdAt: '2024-01-02' },
      { workId: 'WORK-C', title: 'Note C', contentRaw: 'Content C', createdAt: '2024-01-03' },
    ];

    // Mock DatabaseClient queries for count and fetching work notes
    (
      processor as unknown as {
        db: { queryOne: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
      }
    ).db = {
      queryOne: vi.fn().mockResolvedValue({ count: 3 }),
      query: vi.fn().mockResolvedValue({ rows: mockWorkNotes }),
    };

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

      // Mock conditional embedded_at update with immediate resolution
      (processor as TestEmbeddingProcessor).repository.updateEmbeddedAtIfUpdatedAtMatches = vi
        .fn()
        .mockImplementation(async (workId: string) => {
          callOrder.push(`update-${workId}`);
          return true;
        });

      // Create a chunk map for 3 work notes
      const workNoteChunkMap = new Map<string, { chunkIds: string[]; expectedUpdatedAt: string }>([
        ['WORK-A', { chunkIds: ['WORK-A#chunk0'], expectedUpdatedAt: '2024-01-01T00:00:00.000Z' }],
        ['WORK-B', { chunkIds: ['WORK-B#chunk0'], expectedUpdatedAt: '2024-01-02T00:00:00.000Z' }],
        ['WORK-C', { chunkIds: ['WORK-C#chunk0'], expectedUpdatedAt: '2024-01-03T00:00:00.000Z' }],
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

      // Act - call processChunkBatch directly with a finalizer matching work note behavior
      const processChunkBatch = (
        processor as unknown as {
          processChunkBatch: (...args: unknown[]) => Promise<unknown>;
        }
      ).processChunkBatch.bind(processor);
      const finalizeWorkNote = (
        processor as unknown as {
          finalizeWorkNote: (
            workId: string,
            state: { chunkIds: string[]; expectedUpdatedAt: string }
          ) => Promise<void>;
        }
      ).finalizeWorkNote.bind(processor);
      const resultPromise = processChunkBatch(chunks, workNoteChunkMap, finalizeWorkNote);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert: All work notes processed
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);

      // Assert: All deleteStaleChunks called
      expect((processor as TestEmbeddingProcessor).deleteStaleChunks).toHaveBeenCalledTimes(3);

      // Assert: All conditional timestamp updates called
      expect(
        (processor as TestEmbeddingProcessor).repository.updateEmbeddedAtIfUpdatedAtMatches
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

  it('processChunkBatch errors use generic itemId field instead of workId', async () => {
    // Arrange: Make upsertChunks fail so all items are marked as failed
    (processor as TestEmbeddingProcessor).upsertChunks = vi
      .fn()
      .mockRejectedValue(new Error('embedding API down'));

    const chunkMap = new Map<string, { chunkIds: string[]; expectedUpdatedAt: string }>([
      ['ITEM-1', { chunkIds: ['ITEM-1#chunk0'], expectedUpdatedAt: '2024-01-01T00:00:00.000Z' }],
      ['ITEM-2', { chunkIds: ['ITEM-2#chunk0'], expectedUpdatedAt: '2024-01-02T00:00:00.000Z' }],
    ]);

    const chunks = [
      {
        id: 'ITEM-1#chunk0',
        text: 'Content 1',
        metadata: {
          work_id: 'ITEM-1',
          scope: 'WORK',
          chunk_index: 0,
          created_at_bucket: '2024-01-01',
        },
        workId: 'ITEM-1',
      },
      {
        id: 'ITEM-2#chunk0',
        text: 'Content 2',
        metadata: {
          work_id: 'ITEM-2',
          scope: 'WORK',
          chunk_index: 0,
          created_at_bucket: '2024-01-02',
        },
        workId: 'ITEM-2',
      },
    ];

    const processChunkBatch = (
      processor as unknown as {
        processChunkBatch: (...args: unknown[]) => Promise<{
          processed: number;
          succeeded: number;
          failed: number;
          errors: Array<{ itemId: string; error: string; reason: string }>;
        }>;
      }
    ).processChunkBatch.bind(processor);

    // Act
    const result = await processChunkBatch(chunks, chunkMap, vi.fn());

    // Assert: errors should have itemId, not workId
    expect(result.failed).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toHaveProperty('itemId', 'ITEM-1');
    expect(result.errors[1]).toHaveProperty('itemId', 'ITEM-2');
    // Ensure workId is NOT present
    expect(result.errors[0]).not.toHaveProperty('workId');
    expect(result.errors[1]).not.toHaveProperty('workId');
  });
});
