// Trace: SPEC-rag-1, TASK-016
// Unit tests for ChunkingService

import { ChunkingService } from '@worker/services/chunking-service';
import { describe, expect, it } from 'vitest';

describe('ChunkingService', () => {
  const chunkingService = new ChunkingService();

  describe('chunkWorkNote()', () => {
    it('splits long text into multiple chunks with sequential indices', () => {
      const longText = 'word '.repeat(600);
      const chunks = chunkingService.chunkWorkNote('WORK-001', 'Long Document', longText, {
        person_ids: ['P-001'],
        dept_name: 'Engineering',
        category: 'Report',
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].metadata.work_id).toBe('WORK-001');
      expect(chunks[0].metadata.chunk_index).toBe(0);
      expect(chunks[chunks.length - 1].metadata.chunk_index).toBe(chunks.length - 1);
    });

    it('keeps short text in a single chunk including title and content', () => {
      const shortText = 'This is a short text.';
      const chunks = chunkingService.chunkWorkNote('WORK-002', 'Short Note', shortText, {
        person_ids: ['P-002'],
        dept_name: 'HR',
        category: 'Note',
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain('Short Note');
      expect(chunks[0].text).toContain(shortText);
      expect(chunks[0].metadata.chunk_index).toBe(0);
    });

    it('handles empty text by returning a single chunk', () => {
      const chunks = chunkingService.chunkWorkNote('WORK-003', 'Empty Note', '', {
        person_ids: ['P-003'],
        dept_name: 'Admin',
        category: 'Note',
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain('Empty Note');
      expect(chunks[0].metadata.work_id).toBe('WORK-003');
    });

    it('preserves metadata fields including scope', () => {
      const metadata = {
        person_ids: ['P-001', 'P-002'],
        dept_name: 'Engineering',
        category: 'Technical Report',
      };

      const chunks = chunkingService.chunkWorkNote('WORK-004', 'Test', 'Content', metadata);

      expect(chunks[0].metadata.person_ids).toEqual(['P-001', 'P-002']);
      expect(chunks[0].metadata.dept_name).toBe('Engineering');
      expect(chunks[0].metadata.category).toBe('Technical Report');
      expect(chunks[0].metadata.scope).toBe('WORK');
    });
  });

  describe('estimateTokenCount()', () => {
    it('estimates tokens based on length', () => {
      const text = 'This is a test with approximately twenty characters here.';
      const tokens = chunkingService.estimateTokenCount(text);

      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('returns zero for empty text', () => {
      const tokens = chunkingService.estimateTokenCount('');
      expect(tokens).toBe(0);
    });
  });

  describe('getChunkText()', () => {
    it('returns text for a specific chunk index', () => {
      const fullText = 'word '.repeat(200);
      const chunkText = chunkingService.getChunkText(fullText, 0);

      expect(chunkText.length).toBeGreaterThan(0);
    });

    it('returns different text for different indices', () => {
      const fullText = 'word '.repeat(400);
      const chunk0 = chunkingService.getChunkText(fullText, 0);
      const chunk1 = chunkingService.getChunkText(fullText, 1);

      expect(chunk0).not.toBe(chunk1);
    });
  });

  describe('generateChunkId()', () => {
    it('formats chunk IDs using work ID and index', () => {
      const chunkId = ChunkingService.generateChunkId('WORK-001', 2);
      expect(chunkId).toBe('WORK-001#chunk2');
    });
  });

  describe('parseChunkId()', () => {
    it('parses valid chunk IDs', () => {
      const [workId, chunkIndex] = ChunkingService.parseChunkId('WORK-001#chunk5');

      expect(workId).toBe('WORK-001');
      expect(chunkIndex).toBe(5);
    });

    it('throws for invalid chunk ID format', () => {
      expect(() => ChunkingService.parseChunkId('invalid-id')).toThrow(
        'Invalid chunk ID format: invalid-id'
      );
    });
  });
});
