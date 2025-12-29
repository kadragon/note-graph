// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-004

import { jest } from '@jest/globals';
import { RagService } from '@worker/services/rag-service';
import type { Env } from '@worker/types/env';

describe('RagService - PROJECT scope', () => {
  let service: RagService;
  let mockVectorize: { query: jest.Mock<any> };
  let mockEmbedding: { embed: jest.Mock<any> };
  let baseEnv: Env;

  beforeEach(async () => {
    const db = await (global as any).getDB();
    baseEnv = {
      DB: db,
    } as unknown as Env;

    mockVectorize = {
      query: jest.fn<any>().mockResolvedValue({ matches: [] }),
    };
    mockEmbedding = {
      embed: jest.fn<any>().mockResolvedValue(new Array(1536).fill(0.1)),
    };

    service = new RagService(baseEnv);
    // Override vectorizeService to avoid real embeddings/fetch
    (service as any).vectorizeService = mockVectorize;
    (service as any).embeddingService = mockEmbedding;
    // Stub GPT call to avoid network
    (service as any).callGPT = jest.fn<any>().mockResolvedValue('모의 응답');
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

    // Stub work note fetch
    (service as any).fetchWorkNote = jest.fn<any>().mockResolvedValue({
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
    expect((service as any).callGPT).toHaveBeenCalledTimes(1);
  });
});
