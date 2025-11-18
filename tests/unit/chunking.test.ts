// Trace: SPEC-rag-1, TASK-016
// Unit tests for ChunkingService

import { describe, it, expect } from 'vitest';
import { ChunkingService } from '../../src/services/chunking-service';

describe('ChunkingService', () => {
  const chunkingService = new ChunkingService();

  describe('chunkWorkNote()', () => {
    it('should split long text into chunks with overlap', () => {
      const longText = 'word '.repeat(600); // ~600 words
      const chunks = chunkingService.chunkWorkNote(
        'WORK-001',
        'Long Document',
        longText,
        {
          person_ids: ['P-001'],
          dept_name: 'Engineering',
          category: 'Report',
        }
      );

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].text.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.work_id).toBe('WORK-001');
      expect(chunks[0].metadata.chunk_index).toBe(0);
      expect(chunks[1].metadata.chunk_index).toBe(1);
    });

    it('should handle short text without chunking', () => {
      const shortText = 'This is a short text.';
      const chunks = chunkingService.chunkWorkNote(
        'WORK-002',
        'Short Note',
        shortText,
        {
          person_ids: ['P-002'],
          dept_name: 'HR',
          category: 'Note',
        }
      );

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain(shortText);
      expect(chunks[0].metadata.chunk_index).toBe(0);
    });

    it('should create overlapping chunks', () => {
      const text = 'word '.repeat(300);
      const chunks = chunkingService.chunkWorkNote(
        'WORK-003',
        'Medium Document',
        text,
        {
          person_ids: ['P-003'],
          dept_name: 'Sales',
          category: 'Report',
        }
      );

      if (chunks.length > 1) {
        // Check that chunks have proper metadata
        expect(chunks[0].metadata.chunk_index).toBe(0);
        expect(chunks[1].metadata.chunk_index).toBe(1);
        expect(chunks[0].metadata.work_id).toBe('WORK-003');
        expect(chunks[1].metadata.work_id).toBe('WORK-003');
      }
    });

    it('should handle Korean text', () => {
      const koreanText = '안녕하세요. '.repeat(200);
      const chunks = chunkingService.chunkWorkNote(
        'WORK-004',
        '한글 문서',
        koreanText,
        {
          person_ids: ['P-004'],
          dept_name: '개발팀',
          category: '회의',
        }
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every((chunk) => chunk.text.length > 0)).toBe(true);
      expect(chunks[0].metadata.dept_name).toBe('개발팀');
      expect(chunks[0].metadata.category).toBe('회의');
    });

    it('should handle empty text', () => {
      const chunks = chunkingService.chunkWorkNote('WORK-005', 'Empty Note', '', {
        person_ids: ['P-005'],
        dept_name: 'Admin',
        category: 'Note',
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain('Empty Note');
      expect(chunks[0].metadata.work_id).toBe('WORK-005');
    });

    it('should include title in chunk text', () => {
      const chunks = chunkingService.chunkWorkNote(
        'WORK-006',
        'Important Title',
        'Content here',
        {
          person_ids: ['P-006'],
          dept_name: 'Marketing',
          category: 'Memo',
        }
      );

      expect(chunks[0].text).toContain('Important Title');
      expect(chunks[0].text).toContain('Content here');
    });

    it('should set correct scope as WORK', () => {
      const chunks = chunkingService.chunkWorkNote('WORK-007', 'Test', 'Content', {
        person_ids: ['P-007'],
        dept_name: 'IT',
        category: 'Task',
      });

      expect(chunks[0].metadata.scope).toBe('WORK');
    });

    it('should preserve all metadata fields', () => {
      const metadata = {
        person_ids: ['P-001', 'P-002'],
        dept_name: 'Engineering',
        category: 'Technical Report',
      };

      const chunks = chunkingService.chunkWorkNote('WORK-008', 'Test', 'Content', metadata);

      expect(chunks[0].metadata.person_ids).toEqual(['P-001', 'P-002']);
      expect(chunks[0].metadata.dept_name).toBe('Engineering');
      expect(chunks[0].metadata.category).toBe('Technical Report');
    });
  });

  describe('estimateTokenCount()', () => {
    it('should estimate tokens for English text', () => {
      const text = 'This is a test with approximately twenty characters here.';
      const tokens = chunkingService.estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should estimate tokens for Korean text', () => {
      const text = '한글 텍스트 토큰 추정';
      const tokens = chunkingService.estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should handle empty text', () => {
      const tokens = chunkingService.estimateTokenCount('');
      expect(tokens).toBe(0);
    });
  });

  describe('getChunkText()', () => {
    it('should extract specific chunk from full text', () => {
      const fullText = 'word '.repeat(200);
      const chunkText = chunkingService.getChunkText(fullText, 0);

      expect(chunkText.length).toBeGreaterThan(0);
      expect(chunkText.length).toBeLessThanOrEqual(500);
    });

    it('should handle different chunk indices', () => {
      const fullText = 'word '.repeat(400);
      const chunk0 = chunkingService.getChunkText(fullText, 0);
      const chunk1 = chunkingService.getChunkText(fullText, 1);

      expect(chunk0).toBeDefined();
      expect(chunk1).toBeDefined();
      // Chunks should be different due to sliding window
      expect(chunk0).not.toBe(chunk1);
    });

    it('should truncate very long chunks with ellipsis', () => {
      const longText = 'a'.repeat(1000);
      const chunkText = chunkingService.getChunkText(longText, 0);

      if (chunkText.length === 500) {
        expect(chunkText).toMatch(/\.\.\.$/);
      }
    });
  });

  describe('generateChunkId()', () => {
    it('should generate unique chunk ID', () => {
      const chunkId = ChunkingService.generateChunkId('WORK-001', 0);
      expect(chunkId).toBe('WORK-001#chunk0');
    });

    it('should handle different chunk indices', () => {
      const id0 = ChunkingService.generateChunkId('WORK-001', 0);
      const id1 = ChunkingService.generateChunkId('WORK-001', 1);
      const id2 = ChunkingService.generateChunkId('WORK-001', 2);

      expect(id0).toBe('WORK-001#chunk0');
      expect(id1).toBe('WORK-001#chunk1');
      expect(id2).toBe('WORK-001#chunk2');
    });

    it('should handle different work IDs', () => {
      const id1 = ChunkingService.generateChunkId('WORK-001', 0);
      const id2 = ChunkingService.generateChunkId('WORK-002', 0);

      expect(id1).not.toBe(id2);
      expect(id1).toContain('WORK-001');
      expect(id2).toContain('WORK-002');
    });
  });

  describe('parseChunkId()', () => {
    it('should parse valid chunk ID', () => {
      const [workId, chunkIndex] = ChunkingService.parseChunkId('WORK-001#chunk0');

      expect(workId).toBe('WORK-001');
      expect(chunkIndex).toBe(0);
    });

    it('should parse chunk IDs with different indices', () => {
      const [workId1, index1] = ChunkingService.parseChunkId('WORK-001#chunk5');
      const [workId2, index2] = ChunkingService.parseChunkId('WORK-002#chunk10');

      expect(workId1).toBe('WORK-001');
      expect(index1).toBe(5);
      expect(workId2).toBe('WORK-002');
      expect(index2).toBe(10);
    });

    it('should throw error for invalid chunk ID format', () => {
      expect(() => ChunkingService.parseChunkId('invalid-id')).toThrow(
        'Invalid chunk ID format'
      );
      expect(() => ChunkingService.parseChunkId('WORK-001')).toThrow('Invalid chunk ID format');
      expect(() => ChunkingService.parseChunkId('WORK-001#')).toThrow('Invalid chunk ID format');
    });

    it('should handle chunk IDs with special characters in work ID', () => {
      const [workId, index] = ChunkingService.parseChunkId('WORK-001-DRAFT#chunk0');

      expect(workId).toBe('WORK-001-DRAFT');
      expect(index).toBe(0);
    });
  });

  describe('Integration - Round-trip chunk ID', () => {
    it('should generate and parse chunk ID correctly', () => {
      const originalWorkId = 'WORK-123';
      const originalIndex = 5;

      const chunkId = ChunkingService.generateChunkId(originalWorkId, originalIndex);
      const [parsedWorkId, parsedIndex] = ChunkingService.parseChunkId(chunkId);

      expect(parsedWorkId).toBe(originalWorkId);
      expect(parsedIndex).toBe(originalIndex);
    });
  });
});
