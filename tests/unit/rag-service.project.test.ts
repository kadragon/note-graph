// Trace: SPEC-project-1, TASK-044

import { env } from 'cloudflare:test';
import { RagService } from '@worker/services/rag-service';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TestRagService extends RagService {
  vectorizeService: typeof mockVectorize;
  embeddingService: typeof mockEmbedding;
  callGPT: ReturnType<typeof vi.fn>;
  fetchWorkNote: ReturnType<typeof vi.fn>;
  fetchWorkNotesByIds: ReturnType<typeof vi.fn>;
}

describe('RagService - PROJECT scope', () => {
  const baseEnv = env as unknown as Env;
  let service: RagService;
  let mockVectorize: { query: ReturnType<typeof vi.fn> };
  let mockEmbedding: { embed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockVectorize = {
      query: vi.fn().mockResolvedValue({ matches: [] }),
    };
    mockEmbedding = {
      embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    };

    service = new RagService(baseEnv);
    // Override vectorizeService to avoid real embeddings/fetch
    (service as TestRagService).vectorizeService = mockVectorize;
    (service as TestRagService).embeddingService = mockEmbedding;
    // Stub GPT call to avoid network
    (service as TestRagService).callGPT = vi.fn().mockResolvedValue('모의 응답');
  });

  it('applies project_id filter when scope is PROJECT', async () => {
    await service.query('프로젝트 질문', { scope: 'project', projectId: 'PROJECT-123', topK: 3 });

    expect(mockEmbedding.embed).toHaveBeenCalledWith('프로젝트 질문');
    expect(mockVectorize.query).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        topK: 3,
        filter: { project_id: 'PROJECT-123' },
        returnMetadata: true,
      })
    );
  });

  it('keeps only chunks above similarity threshold for PROJECT scope', async () => {
    // Arrange vector search results
    const vectorResults = [
      { id: 'WORK-1#chunk0', score: 0.82, metadata: { chunk_index: '0' } },
      { id: 'WORK-2#chunk0', score: 0.31, metadata: { chunk_index: '0' } },
    ];
    mockVectorize.query.mockResolvedValue({ matches: vectorResults });

    // Stub batch work note fetch
    const mockWorkNotes = new Map([
      ['WORK-1', { workId: 'WORK-1', title: '프로젝트 노트', contentRaw: '프로젝트 관련 내용' }],
    ]);
    (service as TestRagService).fetchWorkNotesByIds = vi.fn().mockResolvedValue(mockWorkNotes);

    // Act
    const response = await service.query('무엇을 해야 하나요?', {
      scope: 'project',
      projectId: 'PROJECT-1',
      topK: 2,
    });

    // Assert
    expect(response.contexts).toHaveLength(1);
    expect(response.contexts[0].workId).toBe('WORK-1');
    expect(response.contexts[0].score).toBeCloseTo(0.82);
    expect((service as TestRagService).callGPT).toHaveBeenCalledTimes(1);
  });

  it('batch fetches work notes instead of sequential N+1 queries', async () => {
    // Arrange: 3 vector results pointing to 3 different work notes
    const vectorResults = [
      { id: 'WORK-A#chunk0', score: 0.9, metadata: { chunk_index: '0' } },
      { id: 'WORK-B#chunk0', score: 0.85, metadata: { chunk_index: '0' } },
      { id: 'WORK-C#chunk0', score: 0.8, metadata: { chunk_index: '0' } },
    ];
    mockVectorize.query.mockResolvedValue({ matches: vectorResults });

    // Mock batch fetch - should be called once with all IDs
    const mockWorkNotes = new Map([
      ['WORK-A', { workId: 'WORK-A', title: 'Note A', contentRaw: 'Content A' }],
      ['WORK-B', { workId: 'WORK-B', title: 'Note B', contentRaw: 'Content B' }],
      ['WORK-C', { workId: 'WORK-C', title: 'Note C', contentRaw: 'Content C' }],
    ]);
    (service as TestRagService).fetchWorkNotesByIds = vi.fn().mockResolvedValue(mockWorkNotes);

    // Act
    const response = await service.query('검색 질문', {
      scope: 'project',
      projectId: 'PROJECT-1',
      topK: 5,
    });

    // Assert: fetchWorkNotesByIds called once with all unique work IDs
    expect((service as TestRagService).fetchWorkNotesByIds).toHaveBeenCalledTimes(1);
    expect((service as TestRagService).fetchWorkNotesByIds).toHaveBeenCalledWith([
      'WORK-A',
      'WORK-B',
      'WORK-C',
    ]);

    // Assert: all 3 contexts returned
    expect(response.contexts).toHaveLength(3);
    expect(response.contexts.map((c) => c.workId)).toEqual(['WORK-A', 'WORK-B', 'WORK-C']);
  });
});
