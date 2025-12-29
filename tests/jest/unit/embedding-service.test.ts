// Unit tests for OpenAIEmbeddingService and VectorizeService
// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-004

import { jest } from '@jest/globals';
import type { ChunkMetadata } from '@shared/types/search';
import { OpenAIEmbeddingService } from '@worker/services/openai-embedding-service';
import { VectorizeService } from '@worker/services/vectorize-service';
import type { Env } from '@worker/types/env';

// Mock environment for testing
const testEnv: Env = {
  OPENAI_API_KEY: 'test-key',
  AI: {} as any,
  VECTORIZE: {} as any,
  DB: {} as any,
} as unknown as Env;

describe('OpenAIEmbeddingService', () => {
  let service: OpenAIEmbeddingService;
  let mockFetch: jest.Mock<any>;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as any;
    service = new OpenAIEmbeddingService(testEnv);
  });

  describe('embed()', () => {
    it('should generate embedding for single text', async () => {
      // Arrange
      const text = 'Test text for embedding';
      const mockEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
      });

      // Act
      const result = await service.embed(text);

      // Assert
      expect(result).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/embeddings'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringContaining('Bearer'),
          }),
          body: expect.stringContaining(text),
        })
      );
    });

    it('should throw error when no embedding is returned', async () => {
      // Arrange
      const text = 'Test text';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
        }),
      });

      // Act & Assert
      await expect(service.embed(text)).rejects.toThrow('No embedding returned from OpenAI API');
    });

    it('should throw error on API failure', async () => {
      // Arrange
      const text = 'Test text';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      // Act & Assert
      await expect(service.embed(text)).rejects.toThrow('OpenAI API error');
    });

    it('should throw rate limit error on 429 status', async () => {
      // Arrange
      const text = 'Test text';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      // Act & Assert
      await expect(service.embed(text)).rejects.toThrow(
        'AI_RATE_LIMIT: Embedding rate limit exceeded'
      );
    });
  });

  describe('embedBatch()', () => {
    it('should generate embeddings for multiple texts', async () => {
      // Arrange
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockEmbeddings = texts.map((_, i) =>
        new Array(1536).fill(0).map((_, j) => (i + j) / 1536)
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockEmbeddings.map((embedding, index) => ({ embedding, index })),
        }),
      });

      // Act
      const result = await service.embedBatch(texts);

      // Assert
      expect(result).toEqual(mockEmbeddings);
      expect(result).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return empty array for empty input', async () => {
      // Arrange
      const texts: string[] = [];

      // Act
      const result = await service.embedBatch(texts);

      // Assert
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should batch process large number of texts', async () => {
      // Arrange
      const texts = Array(50)
        .fill('')
        .map((_, i) => `Text ${i}`);
      const mockEmbeddings = texts.map(() => new Array(1536).fill(0).map((_, i) => i / 1536));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockEmbeddings.map((embedding, index) => ({ embedding, index })),
        }),
      });

      // Act
      const result = await service.embedBatch(texts);

      // Assert
      expect(result).toHaveLength(50);
    });
  });
});

interface MockVectorizeIndex {
  upsert: jest.Mock<any>;
  deleteByIds: jest.Mock<any>;
  query: jest.Mock<any>;
}

describe('VectorizeService', () => {
  let service: VectorizeService;
  let mockVectorize: MockVectorizeIndex;

  beforeEach(() => {
    // Mock Vectorize index
    mockVectorize = {
      upsert: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      deleteByIds: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      query: jest.fn<() => Promise<any>>().mockResolvedValue({ matches: [] }),
    };

    service = new VectorizeService(mockVectorize as any);
  });

  describe('insert()', () => {
    it('should upsert vectors into Vectorize', async () => {
      const vectors = [{ id: 'WORK-1', values: [0.1, 0.2], metadata: { scope: 'WORK' } }];

      await service.insert(vectors);

      expect(mockVectorize.upsert).toHaveBeenCalledWith(vectors);
    });

    it('should skip insert when vectors are empty', async () => {
      await service.insert([]);

      expect(mockVectorize.upsert).not.toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('should delete vectors by IDs', async () => {
      const ids = ['WORK-1', 'WORK-2'];

      await service.delete(ids);

      expect(mockVectorize.deleteByIds).toHaveBeenCalledWith(ids);
    });

    it('should skip delete when IDs are empty', async () => {
      await service.delete([]);

      expect(mockVectorize.deleteByIds).not.toHaveBeenCalled();
    });
  });

  describe('query()', () => {
    it('should query Vectorize with embedding and options', async () => {
      const embedding = new Array(1536).fill(0.1);
      const options = { topK: 5, filter: { scope: 'WORK' }, returnMetadata: true };

      await service.query(embedding, options);

      expect(mockVectorize.query).toHaveBeenCalledWith(embedding, options);
    });
  });

  describe('encodeMetadata()', () => {
    it('should truncate long metadata fields to fit byte limits', () => {
      const longDeptName = '매우긴부서이름'.repeat(20); // Over 60 bytes
      const metadata: ChunkMetadata = {
        work_id: 'WORK-1',
        scope: 'WORK',
        chunk_index: 0,
        created_at_bucket: '2024-01-01',
        dept_name: longDeptName,
      };

      const encoded = VectorizeService.encodeMetadata(metadata);
      const deptNameBytes = new TextEncoder().encode(encoded.dept_name ?? '').length;

      expect(deptNameBytes).toBeLessThanOrEqual(60);
    });
  });

  describe('Static helper methods', () => {
    it('should encode person IDs to comma-separated string', () => {
      // Arrange
      const personIds = ['123456', '234567', '345678'];

      // Act
      const encoded = VectorizeService.encodePersonIds(personIds);

      // Assert
      expect(encoded).toBe('123456,234567,345678');
    });

    it('should decode person IDs from comma-separated string', () => {
      // Arrange
      const encoded = '123456,234567,345678';

      // Act
      const decoded = VectorizeService.decodePersonIds(encoded);

      // Assert
      expect(decoded).toEqual(['123456', '234567', '345678']);
    });

    it('should handle empty string when decoding', () => {
      // Arrange
      const encoded = '';

      // Act
      const decoded = VectorizeService.decodePersonIds(encoded);

      // Assert
      // Empty string split returns an empty array (handled by ternary in implementation)
      expect(decoded).toEqual([]);
    });

    it('should handle single person ID', () => {
      // Arrange
      const personIds = ['123456'];

      // Act
      const encoded = VectorizeService.encodePersonIds(personIds);
      const decoded = VectorizeService.decodePersonIds(encoded);

      // Assert
      expect(encoded).toBe('123456');
      expect(decoded).toEqual(['123456']);
    });
  });
});
