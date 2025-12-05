// Trace: SPEC-project-1, TASK-044

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RagService } from '@/services/rag-service';
import type { Env } from '@/types/env';

interface TestRagService extends RagService {
  vectorizeService: typeof mockVectorize;
  callGPT: ReturnType<typeof vi.fn>;
  fetchWorkNote: ReturnType<typeof vi.fn>;
}

describe('RagService - PROJECT scope', () => {
  const baseEnv = env as unknown as Env;
  let service: RagService;
  let mockVectorize: { search: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockVectorize = {
      search: vi.fn().mockResolvedValue([]),
    };

    service = new RagService(baseEnv);
    // Override vectorizeService to avoid real embeddings/fetch
    (service as TestRagService).vectorizeService = mockVectorize;
    // Stub GPT call to avoid network
    (service as TestRagService).callGPT = vi.fn().mockResolvedValue('모의 응답');
  });

  it('applies project_id filter when scope is PROJECT', async () => {
    await service.query('프로젝트 질문', { scope: 'project', projectId: 'PROJECT-123', topK: 3 });

    expect(mockVectorize.search).toHaveBeenCalledWith('프로젝트 질문', 3, {
      project_id: 'PROJECT-123',
    });
  });

  it('keeps only chunks above similarity threshold for PROJECT scope', async () => {
    // Arrange vector search results
    const vectorResults = [
      { id: 'WORK-1#chunk0', score: 0.82, metadata: { chunk_index: '0' } },
      { id: 'WORK-2#chunk0', score: 0.31, metadata: { chunk_index: '0' } },
    ];
    mockVectorize.search.mockResolvedValue(vectorResults);

    // Stub work note fetch
    (service as TestRagService).fetchWorkNote = vi.fn().mockResolvedValue({
      workId: 'WORK-1',
      title: '프로젝트 노트',
      contentRaw: '프로젝트 관련 내용',
    });

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
});
