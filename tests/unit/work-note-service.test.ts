// Trace: SPEC-ai-draft-refs-1, TASK-029, TASK-031

import type { ReferenceTodo } from '@shared/types/search';
import type { WorkNote } from '@shared/types/work-note';
import { WorkNoteService } from '@worker/services/work-note-service';
import type { Env } from '@worker/types/env';
import { describe, expect, it, vi } from 'vitest';

// Minimal env stub to satisfy constructor; services are mocked per test
const dummyEnv = {
  DB: {} as unknown,
  VECTORIZE: {
    query: vi.fn(),
    upsert: vi.fn(),
    deleteByIds: vi.fn(),
  } as unknown,
  OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
  OPENAI_API_KEY: 'test',
  OPENAI_API_BASE: 'https://example.test',
  AI_GATEWAY_BASE_URL: 'https://gateway.test',
  AI_GATEWAY_ID: 'dummy',
} as unknown as Env;

describe('WorkNoteService.findSimilarNotes', () => {
  it('returns workId and similarity score for matched notes above threshold', async () => {
    const service = new WorkNoteService(dummyEnv);

    const mockEmbed = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));
    const mockQuery = vi.fn().mockResolvedValue({
      matches: [
        { id: 'WORK-1#chunk0', score: 0.9, metadata: {} },
        { id: 'WORK-2#chunk1', score: 0.4, metadata: {} },
      ],
    });

    const mockFindByIds = vi.fn().mockResolvedValue([
      {
        workId: 'WORK-1',
        title: '유사한 업무노트 1',
        contentRaw: '회의 기록...',
        category: '기획',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        embeddedAt: '2025-01-02T00:00:00.000Z',
      },
      {
        workId: 'WORK-2',
        title: '유사한 업무노트 2',
        contentRaw: '별도 메모',
        category: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        embeddedAt: '2025-01-02T00:00:00.000Z',
      },
    ] as WorkNote[]);

    const mockFindTodosByWorkIds = vi.fn().mockResolvedValue(new Map());

    // Override internal services with mocks
    (service as unknown as { vectorizeService: unknown }).vectorizeService = { query: mockQuery };
    (service as unknown as { embeddingService: unknown }).embeddingService = { embed: mockEmbed };
    (service as unknown as { repository: unknown }).repository = {
      findByIds: mockFindByIds,
      findTodosByWorkIds: mockFindTodosByWorkIds,
    } as unknown;

    const result = await service.findSimilarNotes('프로젝트 회의', 3, 0.5);

    expect(result).toEqual([
      {
        workId: 'WORK-1',
        title: '유사한 업무노트 1',
        content: '회의 기록...',
        category: '기획',
        similarityScore: 0.9,
        todos: [],
      },
    ]);
    expect(mockFindByIds).toHaveBeenCalledWith(['WORK-1']);
    expect(mockFindTodosByWorkIds).toHaveBeenCalledWith(['WORK-1']);
  });

  it('returns no results when all matches are below scoreThreshold', async () => {
    const service = new WorkNoteService(dummyEnv);

    const mockEmbed = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));
    const mockQuery = vi.fn().mockResolvedValue({
      matches: [
        { id: 'WORK-1#chunk0', score: 0.2, metadata: {} },
        { id: 'WORK-2#chunk1', score: 0.1, metadata: {} },
      ],
    });

    const mockFindByIds = vi.fn().mockResolvedValue([]);
    const mockFindTodosByWorkIds = vi.fn().mockResolvedValue(new Map());

    (service as unknown as { vectorizeService: unknown }).vectorizeService = { query: mockQuery };
    (service as unknown as { embeddingService: unknown }).embeddingService = { embed: mockEmbed };
    (service as unknown as { repository: unknown }).repository = {
      findByIds: mockFindByIds,
      findTodosByWorkIds: mockFindTodosByWorkIds,
    } as unknown;

    const result = await service.findSimilarNotes('관련 없는 텍스트', 3, 0.7);

    expect(result).toEqual([]);
    expect(mockFindByIds).not.toHaveBeenCalled();
    expect(mockFindTodosByWorkIds).not.toHaveBeenCalled();
  });

  it('includes todos in similar notes results', async () => {
    const service = new WorkNoteService(dummyEnv);

    const mockEmbed = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));
    const mockQuery = vi.fn().mockResolvedValue({
      matches: [{ id: 'WORK-1#chunk0', score: 0.85, metadata: {} }],
    });

    const mockFindByIds = vi.fn().mockResolvedValue([
      {
        workId: 'WORK-1',
        title: '프로젝트 계획',
        contentRaw: '프로젝트 계획 내용...',
        category: '기획',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        embeddedAt: '2025-01-02T00:00:00.000Z',
      },
    ] as WorkNote[]);

    const mockTodos: ReferenceTodo[] = [
      {
        title: '요구사항 분석',
        description: '고객 요구사항 정리',
        status: '완료',
        dueDate: '2025-01-15',
      },
      {
        title: '설계 문서 작성',
        description: null,
        status: '진행중',
        dueDate: '2025-01-20',
      },
    ];

    const todosMap = new Map<string, ReferenceTodo[]>();
    todosMap.set('WORK-1', mockTodos);

    const mockFindTodosByWorkIds = vi.fn().mockResolvedValue(todosMap);

    // Override internal services with mocks
    (service as unknown as { vectorizeService: unknown }).vectorizeService = { query: mockQuery };
    (service as unknown as { embeddingService: unknown }).embeddingService = { embed: mockEmbed };
    (service as unknown as { repository: unknown }).repository = {
      findByIds: mockFindByIds,
      findTodosByWorkIds: mockFindTodosByWorkIds,
    } as unknown;

    const result = await service.findSimilarNotes('프로젝트 계획', 3, 0.7);

    expect(result).toHaveLength(1);
    expect(result[0].workId).toBe('WORK-1');
    expect(result[0].todos).toHaveLength(2);
    expect(result[0].todos?.[0]).toEqual({
      title: '요구사항 분석',
      description: '고객 요구사항 정리',
      status: '완료',
      dueDate: '2025-01-15',
    });
    expect(result[0].todos?.[1]).toEqual({
      title: '설계 문서 작성',
      description: null,
      status: '진행중',
      dueDate: '2025-01-20',
    });
  });

  it('returns empty todos array when work note has no todos', async () => {
    const service = new WorkNoteService(dummyEnv);

    const mockEmbed = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));
    const mockQuery = vi.fn().mockResolvedValue({
      matches: [{ id: 'WORK-1#chunk0', score: 0.8, metadata: {} }],
    });

    const mockFindByIds = vi.fn().mockResolvedValue([
      {
        workId: 'WORK-1',
        title: '간단한 메모',
        contentRaw: '메모 내용',
        category: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        embeddedAt: '2025-01-02T00:00:00.000Z',
      },
    ] as WorkNote[]);

    // Return empty map (no todos)
    const mockFindTodosByWorkIds = vi.fn().mockResolvedValue(new Map());

    // Override internal services with mocks
    (service as unknown as { vectorizeService: unknown }).vectorizeService = { query: mockQuery };
    (service as unknown as { embeddingService: unknown }).embeddingService = { embed: mockEmbed };
    (service as unknown as { repository: unknown }).repository = {
      findByIds: mockFindByIds,
      findTodosByWorkIds: mockFindTodosByWorkIds,
    } as unknown;

    const result = await service.findSimilarNotes('메모', 3, 0.7);

    expect(result).toHaveLength(1);
    expect(result[0].todos).toEqual([]);
  });
});

describe('WorkNoteService Google Drive integration', () => {
  it('enables drive service when Google Drive credentials are configured', () => {
    const envWithDrive = {
      ...dummyEnv,
      R2_BUCKET: {} as Env['R2_BUCKET'],
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GDRIVE_ROOT_FOLDER_ID: 'test-gdrive-root-folder-id',
    } as Env;

    const service = new WorkNoteService(envWithDrive);
    const fileService = (service as unknown as { fileService: unknown }).fileService as null | {
      driveService?: unknown;
    };

    expect(fileService).toBeTruthy();
    expect(fileService?.driveService).not.toBeNull();
  });
});

describe('WorkNoteService.delete', () => {
  it('returns cleanupPromise and passes userEmail to deleteWorkNoteFiles when provided', async () => {
    const service = new WorkNoteService(dummyEnv);

    const deleteWorkNoteFiles = vi.fn().mockResolvedValue(undefined);
    const deleteChunkRange = vi.fn().mockResolvedValue(undefined);
    const estimateChunkCount = vi.fn().mockReturnValue(1);
    const getMaxKnownChunkCount = vi.fn().mockResolvedValue(1);
    const findById = vi.fn().mockResolvedValue({
      workId: 'WORK-123',
      title: 'short title',
      contentRaw: 'short content',
      category: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      embeddedAt: null,
    } satisfies WorkNote);
    const repositoryDelete = vi.fn().mockResolvedValue(undefined);

    (service as unknown as { fileService: unknown }).fileService = {
      deleteWorkNoteFiles,
    };
    (service as unknown as { repository: unknown }).repository = {
      findById,
      delete: repositoryDelete,
    };
    (service as unknown as { embeddingProcessor: unknown }).embeddingProcessor = {
      estimateChunkCount,
      getMaxKnownChunkCount,
      deleteChunkRange,
    };

    const { cleanupPromise } = await service.delete('WORK-123', 'tester@example.com');
    await cleanupPromise;

    expect(deleteWorkNoteFiles).toHaveBeenCalledWith('WORK-123', 'tester@example.com');
    expect(deleteChunkRange).toHaveBeenCalledWith('WORK-123', 0, 1);
    expect(repositoryDelete).toHaveBeenCalledWith('WORK-123');
  });
});

describe('WorkNoteService embedding guards and deterministic stale deletion', () => {
  it('deletes stale chunk IDs by deterministic range', async () => {
    const service = new WorkNoteService(dummyEnv);

    const findById = vi.fn().mockResolvedValue({
      workId: 'WORK-1',
      title: 'title',
      contentRaw: 'content',
      category: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      embeddedAt: null,
    } satisfies WorkNote);
    const updateEmbeddedAtIfUpdatedAtMatches = vi.fn().mockResolvedValue(true);
    const getDeptNameForPerson = vi.fn().mockResolvedValue(null);
    const upsertChunks = vi.fn().mockResolvedValue(undefined);
    const deleteChunkRange = vi.fn().mockResolvedValue(undefined);

    (service as unknown as { repository: unknown }).repository = {
      findById,
      updateEmbeddedAtIfUpdatedAtMatches,
      getDeptNameForPerson,
    };
    (service as unknown as { embeddingProcessor: unknown }).embeddingProcessor = {
      upsertChunks,
      deleteChunkRange,
    };

    const performChunkingAndEmbedding = (
      service as unknown as {
        performChunkingAndEmbedding: (
          workNote: WorkNote,
          personIds: string[],
          options: {
            deleteStaleChunks?: boolean;
            previousChunkCount?: number;
            expectedUpdatedAt?: string;
          }
        ) => Promise<void>;
      }
    ).performChunkingAndEmbedding.bind(service);

    await performChunkingAndEmbedding(
      {
        workId: 'WORK-1',
        title: 'title',
        contentRaw: 'content',
        category: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        embeddedAt: null,
      },
      [],
      {
        deleteStaleChunks: true,
        previousChunkCount: 3,
        expectedUpdatedAt: '2025-01-01T00:00:00.000Z',
      }
    );

    expect(deleteChunkRange).toHaveBeenCalledWith('WORK-1', 1, 3);
    expect(updateEmbeddedAtIfUpdatedAtMatches).toHaveBeenCalledWith(
      'WORK-1',
      '2025-01-01T00:00:00.000Z'
    );
  });

  it('rolls back freshly upserted chunks when post-upsert version check fails', async () => {
    const service = new WorkNoteService(dummyEnv);

    const findById = vi
      .fn()
      .mockResolvedValueOnce({
        workId: 'WORK-1',
        title: 'title',
        contentRaw: 'content',
        category: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        embeddedAt: null,
      } satisfies WorkNote)
      .mockResolvedValueOnce({
        workId: 'WORK-1',
        title: 'title',
        contentRaw: 'content updated',
        category: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        embeddedAt: null,
      } satisfies WorkNote);
    const getDeptNameForPerson = vi.fn().mockResolvedValue(null);
    const upsertChunks = vi.fn().mockResolvedValue(undefined);
    const deleteChunkIdsInBatches = vi.fn().mockResolvedValue(undefined);
    const updateEmbeddedAtIfUpdatedAtMatches = vi.fn();

    (service as unknown as { repository: unknown }).repository = {
      findById,
      getDeptNameForPerson,
      updateEmbeddedAtIfUpdatedAtMatches,
    };
    (service as unknown as { embeddingProcessor: unknown }).embeddingProcessor = {
      upsertChunks,
      deleteChunkIdsInBatches,
    };

    const performChunkingAndEmbedding = (
      service as unknown as {
        performChunkingAndEmbedding: (
          workNote: WorkNote,
          personIds: string[],
          options: {
            deleteStaleChunks?: boolean;
            previousChunkCount?: number;
            expectedUpdatedAt?: string;
          }
        ) => Promise<void>;
      }
    ).performChunkingAndEmbedding.bind(service);

    await performChunkingAndEmbedding(
      {
        workId: 'WORK-1',
        title: 'title',
        contentRaw: 'content',
        category: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        embeddedAt: null,
      },
      [],
      {
        expectedUpdatedAt: '2025-01-01T00:00:00.000Z',
      }
    );

    expect(updateEmbeddedAtIfUpdatedAtMatches).not.toHaveBeenCalled();
    expect(deleteChunkIdsInBatches).toHaveBeenCalledWith(['WORK-1#chunk0']);
  });
});
