// Unit tests for EmbeddingService and VectorizeService
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import type { Env } from '../../src/types/env';
import { EmbeddingService, VectorizeService } from '../../src/services/embedding-service';
import type { ChunkMetadata } from '../../src/types/search';

const testEnv = env as unknown as Env;

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    service = new EmbeddingService(testEnv);
  });

  describe('generateEmbedding()', () => {
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
      const result = await service.generateEmbedding(text);

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
      await expect(service.generateEmbedding(text)).rejects.toThrow(
        'No embedding returned from OpenAI API'
      );
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
      await expect(service.generateEmbedding(text)).rejects.toThrow('OpenAI API error');
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
      await expect(service.generateEmbedding(text)).rejects.toThrow(
        'AI_RATE_LIMIT: Embedding rate limit exceeded'
      );
    });
  });

  describe('generateEmbeddings()', () => {
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
      const result = await service.generateEmbeddings(texts);

      // Assert
      expect(result).toEqual(mockEmbeddings);
      expect(result).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return empty array for empty input', async () => {
      // Arrange
      const texts: string[] = [];

      // Act
      const result = await service.generateEmbeddings(texts);

      // Assert
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should batch process large number of texts', async () => {
      // Arrange
      const texts = Array(50).fill('').map((_, i) => `Text ${i}`);
      const mockEmbeddings = texts.map(() =>
        new Array(1536).fill(0).map((_, i) => i / 1536)
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockEmbeddings.map((embedding, index) => ({ embedding, index })),
        }),
      });

      // Act
      const result = await service.generateEmbeddings(texts);

      // Assert
      expect(result).toHaveLength(50);
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

describe('VectorizeService', () => {
  let service: VectorizeService;
  let embeddingService: EmbeddingService;
  let mockVectorize: any;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    embeddingService = new EmbeddingService(testEnv);

    // Mock Vectorize index
    mockVectorize = {
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteByIds: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ matches: [] }),
    };

    service = new VectorizeService(mockVectorize, embeddingService);
  });

  describe('upsertWorkNote()', () => {
    it('should upsert work note with embedding', async () => {
      // Arrange
      const workId = 'WORK-001';
      const title = 'Test Work Note';
      const content = 'Test content for work note';
      const metadata: Omit<ChunkMetadata, 'work_id' | 'scope' | 'chunk_index'> = {
        person_ids: '123456,234567',
        dept_name: '개발팀',
        category: '업무',
        created_at_bucket: '2024-01-01',
      };

      const mockEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
      });

      // Act
      await service.upsertWorkNote(workId, title, content, metadata);

      // Assert
      expect(mockVectorize.upsert).toHaveBeenCalledWith([
        {
          id: workId,
          values: mockEmbedding,
          metadata: expect.objectContaining({
            work_id: workId,
            scope: 'WORK',
            chunk_index: '0',
            person_ids: '123456,234567',
            dept_name: '개발팀',
            category: '업무',
            created_at_bucket: '2024-01-01',
          }),
        },
      ]);
    });

    it('should combine title and content for embedding', async () => {
      // Arrange
      const workId = 'WORK-002';
      const title = 'Title';
      const content = 'Content';
      const metadata: Omit<ChunkMetadata, 'work_id' | 'scope' | 'chunk_index'> = {};

      const mockEmbedding = new Array(1536).fill(0);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
      });

      // Act
      await service.upsertWorkNote(workId, title, content, metadata);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Title\\n\\nContent'),
        })
      );
    });

    it('should truncate long metadata fields to fit byte limits', async () => {
      // Arrange
      const workId = 'WORK-003';
      const title = 'Test';
      const content = 'Test';
      const longDeptName = '매우긴부서이름'.repeat(20); // Over 60 bytes
      const metadata: Omit<ChunkMetadata, 'work_id' | 'scope' | 'chunk_index'> = {
        dept_name: longDeptName,
      };

      const mockEmbedding = new Array(1536).fill(0);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
      });

      // Act
      await service.upsertWorkNote(workId, title, content, metadata);

      // Assert
      expect(mockVectorize.upsert).toHaveBeenCalled();
      const call = mockVectorize.upsert.mock.calls[0][0][0];
      const deptNameBytes = new TextEncoder().encode(call.metadata.dept_name).length;
      expect(deptNameBytes).toBeLessThanOrEqual(60);
    });
  });

  describe('upsertChunks()', () => {
    it('should upsert multiple chunks with batch embedding', async () => {
      // Arrange
      const chunks = [
        {
          id: 'WORK-001#chunk0',
          text: 'Chunk 1 text',
          metadata: {
            work_id: 'WORK-001',
            scope: 'WORK' as const,
            chunk_index: 0,
          },
        },
        {
          id: 'WORK-001#chunk1',
          text: 'Chunk 2 text',
          metadata: {
            work_id: 'WORK-001',
            scope: 'WORK' as const,
            chunk_index: 1,
          },
        },
      ];

      const mockEmbeddings = [
        new Array(1536).fill(0).map((_, i) => i / 1536),
        new Array(1536).fill(0).map((_, i) => (i + 1) / 1536),
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockEmbeddings.map((embedding, index) => ({ embedding, index })),
        }),
      });

      // Act
      await service.upsertChunks(chunks);

      // Assert
      expect(mockVectorize.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'WORK-001#chunk0',
            values: mockEmbeddings[0],
          }),
          expect.objectContaining({
            id: 'WORK-001#chunk1',
            values: mockEmbeddings[1],
          }),
        ])
      );
    });

    it('should handle empty chunks array', async () => {
      // Act
      await service.upsertChunks([]);

      // Assert
      expect(mockVectorize.upsert).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error if embedding is missing for chunk', async () => {
      // Arrange
      const chunks = [
        {
          id: 'WORK-001#chunk0',
          text: 'Chunk text',
          metadata: {
            work_id: 'WORK-001',
            scope: 'WORK' as const,
            chunk_index: 0,
          },
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [], // Empty embeddings
        }),
      });

      // Act & Assert
      await expect(service.upsertChunks(chunks)).rejects.toThrow(
        'Missing embedding for chunk'
      );
    });
  });

  describe('deleteWorkNote()', () => {
    it('should delete work note by ID', async () => {
      // Arrange
      const workId = 'WORK-001';

      // Act
      await service.deleteWorkNote(workId);

      // Assert
      expect(mockVectorize.deleteByIds).toHaveBeenCalledWith([workId]);
    });
  });

  describe('deleteWorkNoteChunks()', () => {
    it('should delete all chunks for work note', async () => {
      // Arrange
      const workId = 'WORK-001';
      mockVectorize.query.mockResolvedValue({
        matches: [
          { id: 'WORK-001#chunk0', score: 1.0 },
          { id: 'WORK-001#chunk1', score: 1.0 },
          { id: 'WORK-001#chunk2', score: 1.0 },
        ],
      });

      // Act
      await service.deleteWorkNoteChunks(workId);

      // Assert
      expect(mockVectorize.query).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          topK: 500,
          filter: { work_id: workId },
          returnMetadata: false,
        })
      );
      expect(mockVectorize.deleteByIds).toHaveBeenCalledWith([
        'WORK-001#chunk0',
        'WORK-001#chunk1',
        'WORK-001#chunk2',
      ]);
    });

    it('should not delete if no chunks found', async () => {
      // Arrange
      const workId = 'WORK-002';
      mockVectorize.query.mockResolvedValue({ matches: [] });

      // Act
      await service.deleteWorkNoteChunks(workId);

      // Assert
      expect(mockVectorize.deleteByIds).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const workId = 'WORK-003';
      mockVectorize.query.mockRejectedValue(new Error('Vectorize error'));

      // Act & Assert - Should not throw
      await expect(service.deleteWorkNoteChunks(workId)).resolves.toBeUndefined();
    });
  });

  describe('deleteStaleChunks()', () => {
    it('should delete chunks not in new chunk ID set', async () => {
      // Arrange
      const workId = 'WORK-001';
      const newChunkIds = new Set(['WORK-001#chunk0', 'WORK-001#chunk1']);

      mockVectorize.query.mockResolvedValue({
        matches: [
          { id: 'WORK-001#chunk0', score: 1.0 },
          { id: 'WORK-001#chunk1', score: 1.0 },
          { id: 'WORK-001#chunk2', score: 1.0 }, // Stale
          { id: 'WORK-001#chunk3', score: 1.0 }, // Stale
        ],
      });

      // Act
      await service.deleteStaleChunks(workId, newChunkIds);

      // Assert
      expect(mockVectorize.deleteByIds).toHaveBeenCalledWith([
        'WORK-001#chunk2',
        'WORK-001#chunk3',
      ]);
    });

    it('should not delete if all chunks are current', async () => {
      // Arrange
      const workId = 'WORK-001';
      const newChunkIds = new Set(['WORK-001#chunk0', 'WORK-001#chunk1']);

      mockVectorize.query.mockResolvedValue({
        matches: [
          { id: 'WORK-001#chunk0', score: 1.0 },
          { id: 'WORK-001#chunk1', score: 1.0 },
        ],
      });

      // Act
      await service.deleteStaleChunks(workId, newChunkIds);

      // Assert
      expect(mockVectorize.deleteByIds).not.toHaveBeenCalled();
    });
  });

  describe('search()', () => {
    it('should search for similar work notes', async () => {
      // Arrange
      const query = 'Test search query';
      const topK = 5;
      const mockEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
      });

      mockVectorize.query.mockResolvedValue({
        matches: [
          {
            id: 'WORK-001',
            score: 0.95,
            metadata: { work_id: 'WORK-001', category: '업무' },
          },
          {
            id: 'WORK-002',
            score: 0.87,
            metadata: { work_id: 'WORK-002', category: '회의' },
          },
        ],
      });

      // Act
      const results = await service.search(query, topK);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: 'WORK-001',
        score: 0.95,
        metadata: { work_id: 'WORK-001', category: '업무' },
      });
    });

    it('should apply metadata filter when provided', async () => {
      // Arrange
      const query = 'Test query';
      const filter = { category: '업무' };
      const mockEmbedding = new Array(1536).fill(0);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
      });

      mockVectorize.query.mockResolvedValue({ matches: [] });

      // Act
      await service.search(query, 10, filter);

      // Assert
      expect(mockVectorize.query).toHaveBeenCalledWith(
        mockEmbedding,
        expect.objectContaining({
          filter,
        })
      );
    });
  });
});
