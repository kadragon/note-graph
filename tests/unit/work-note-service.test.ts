// Trace: SPEC-ai-draft-refs-1, TASK-029
import { describe, it, expect, vi } from 'vitest';
import { WorkNoteService } from '../../src/services/work-note-service';
import type { Env } from '../../src/types/env';
import type { WorkNote } from '../../src/types/work-note';

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

    const mockSearch = vi.fn().mockResolvedValue([
      { id: 'WORK-1#chunk0', score: 0.9, metadata: {} },
      { id: 'WORK-2#chunk1', score: 0.4, metadata: {} },
    ]);

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

    // Override internal services with mocks
    (service as unknown as { vectorizeService: unknown }).vectorizeService = { search: mockSearch };
    (service as unknown as { repository: unknown }).repository = { findByIds: mockFindByIds } as unknown;

    const result = await service.findSimilarNotes('프로젝트 회의', 3, 0.5);

    expect(result).toEqual([
      {
        workId: 'WORK-1',
        title: '유사한 업무노트 1',
        content: '회의 기록...',
        category: '기획',
        similarityScore: 0.9,
      },
    ]);
    expect(mockFindByIds).toHaveBeenCalledWith(['WORK-1']);
  });
});
