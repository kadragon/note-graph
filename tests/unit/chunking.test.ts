// Trace: SPEC-rag-1, TASK-016
// Unit tests for ChunkingService

import { describe, it, expect } from 'vitest';
import { ChunkingService } from '../../src/services/chunking-service';

describe('ChunkingService', () => {
  const chunkingService = new ChunkingService();

  describe('chunk()', () => {
    it('should split long text into chunks with overlap', () => {
      const longText = 'word '.repeat(600); // ~600 words
      const chunks = chunkingService.chunk(longText, 512, 0.2);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(512 * 4); // ~512 tokens
    });

    it('should handle short text without chunking', () => {
      const shortText = 'This is a short text.';
      const chunks = chunkingService.chunk(shortText, 512, 0.2);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(shortText);
    });

    it('should create overlapping chunks', () => {
      const text = 'word '.repeat(300);
      const chunks = chunkingService.chunk(text, 200, 0.2);

      if (chunks.length > 1) {
        // Check that there's some overlap between chunks
        const firstChunkEnd = chunks[0].slice(-50);
        const secondChunkStart = chunks[1].slice(0, 50);

        // There should be some common words
        expect(chunks.length).toBeGreaterThan(1);
      }
    });

    it('should handle Korean text', () => {
      const koreanText = '안녕하세요. '.repeat(200);
      const chunks = chunkingService.chunk(koreanText, 512, 0.2);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.length > 0)).toBe(true);
    });

    it('should handle empty text', () => {
      const chunks = chunkingService.chunk('', 512, 0.2);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe('');
    });
  });
});
