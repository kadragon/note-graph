// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-004

import { jest } from '@jest/globals';
import type { ReferenceTodo } from '@shared/types/search';
import type { WorkNote } from '@shared/types/work-note';
import { WorkNoteService } from '@worker/services/work-note-service';
import type { Env } from '@worker/types/env';

describe('WorkNoteService.findSimilarNotes', () => {
  it('returns workId and similarity score for matched notes above threshold', async () => {
    // Create service with minimal env stub to satisfy constructor; services are mocked per test
    const dummyEnv = {
      DB: {} as unknown,
      VECTORIZE: {
        query: jest.fn<any>(),
        upsert: jest.fn<any>(),
        deleteByIds: jest.fn<any>(),
      } as unknown,
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      OPENAI_API_KEY: 'test',
      OPENAI_API_BASE: 'https://example.test',
      AI_GATEWAY_BASE_URL: 'https://gateway.test',
      AI_GATEWAY_ID: 'dummy',
    } as unknown as Env;

    const service = new WorkNoteService(dummyEnv);

    const mockEmbed = jest.fn<any>().mockResolvedValue(new Array(1536).fill(0.1));
    const mockQuery = jest.fn<any>().mockResolvedValue({
      matches: [
        { id: 'WORK-1#chunk0', score: 0.9, metadata: {} },
        { id: 'WORK-2#chunk1', score: 0.4, metadata: {} },
      ],
    });

    const mockFindByIds = jest.fn<any>().mockResolvedValue([
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

    const mockFindTodosByWorkIds = jest.fn<any>().mockResolvedValue(new Map());

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

  it('includes todos in similar notes results', async () => {
    // Create service with minimal env stub to satisfy constructor; services are mocked per test
    const dummyEnv = {
      DB: {} as unknown,
      VECTORIZE: {
        query: jest.fn<any>(),
        upsert: jest.fn<any>(),
        deleteByIds: jest.fn<any>(),
      } as unknown,
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      OPENAI_API_KEY: 'test',
      OPENAI_API_BASE: 'https://example.test',
      AI_GATEWAY_BASE_URL: 'https://gateway.test',
      AI_GATEWAY_ID: 'dummy',
    } as unknown as Env;

    const service = new WorkNoteService(dummyEnv);

    const mockEmbed = jest.fn<any>().mockResolvedValue(new Array(1536).fill(0.1));
    const mockQuery = jest.fn<any>().mockResolvedValue({
      matches: [{ id: 'WORK-1#chunk0', score: 0.85, metadata: {} }],
    });

    const mockFindByIds = jest.fn<any>().mockResolvedValue([
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

    const mockFindTodosByWorkIds = jest.fn<any>().mockResolvedValue(todosMap);

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
    // Create service with minimal env stub to satisfy constructor; services are mocked per test
    const dummyEnv = {
      DB: {} as unknown,
      VECTORIZE: {
        query: jest.fn<any>(),
        upsert: jest.fn<any>(),
        deleteByIds: jest.fn<any>(),
      } as unknown,
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      OPENAI_API_KEY: 'test',
      OPENAI_API_BASE: 'https://example.test',
      AI_GATEWAY_BASE_URL: 'https://gateway.test',
      AI_GATEWAY_ID: 'dummy',
    } as unknown as Env;

    const service = new WorkNoteService(dummyEnv);

    const mockEmbed = jest.fn<any>().mockResolvedValue(new Array(1536).fill(0.1));
    const mockQuery = jest.fn<any>().mockResolvedValue({
      matches: [{ id: 'WORK-1#chunk0', score: 0.8, metadata: {} }],
    });

    const mockFindByIds = jest.fn<any>().mockResolvedValue([
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
    const mockFindTodosByWorkIds = jest.fn<any>().mockResolvedValue(new Map());

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
