// Trace: SPEC-rag-1, TASK-012
import type { ChunkMetadata, TextChunk } from '@shared/types/search';

/**
 * Configuration for text chunking
 */
export interface ChunkConfig {
  /** Chunk size in tokens (default: 512) */
  chunkSize: number;
  /** Overlap ratio between chunks (default: 0.2 = 20%) */
  overlapRatio: number;
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 512,
  overlapRatio: 0.2,
};

/**
 * Chunking service for RAG implementation
 *
 * Uses sliding window approach with configurable overlap to prevent
 * information loss at chunk boundaries.
 *
 * Token approximation: ~4 characters per token (works well for English and Korean)
 */
export class ChunkingService {
  private config: ChunkConfig;

  /** Character-to-token ratio (approximate) */
  private readonly CHARS_PER_TOKEN = 4;

  /** Minimum chunk size ratio (chunks smaller than this are dropped) */
  private readonly MIN_CHUNK_RATIO = 0.1;

  constructor(config: ChunkConfig = DEFAULT_CHUNK_CONFIG) {
    this.config = config;
  }

  /**
   * Chunk work note content into overlapping segments
   *
   * @param workId - Work note ID
   * @param title - Work note title
   * @param content - Work note content
   * @param metadata - Additional metadata (person_ids, dept_name, category, etc.)
   * @returns Array of text chunks with metadata
   */
  chunkWorkNote(
    workId: string,
    title: string,
    content: string,
    metadata: Omit<ChunkMetadata, 'work_id' | 'scope' | 'chunk_index'>
  ): TextChunk[] {
    // Combine title and content for complete context
    const fullText = `${title}\n\n${content}`;

    // Convert to pseudo-tokens (character-based approximation)
    const chunkSizeChars = this.config.chunkSize * this.CHARS_PER_TOKEN;
    const stepChars = Math.floor(chunkSizeChars * (1 - this.config.overlapRatio));

    const chunks: TextChunk[] = [];

    // If text is shorter than chunk size, return single chunk
    if (fullText.length <= chunkSizeChars) {
      chunks.push({
        text: fullText,
        metadata: {
          work_id: workId,
          scope: 'WORK',
          chunk_index: 0,
          ...metadata,
        },
      });
      return chunks;
    }

    // Sliding window chunking with overlap
    let chunkIndex = 0;
    for (let i = 0; i < fullText.length; i += stepChars) {
      const chunkText = fullText.slice(i, i + chunkSizeChars);

      // Skip very small final chunks (< MIN_CHUNK_RATIO of chunk size)
      if (chunkText.length < chunkSizeChars * this.MIN_CHUNK_RATIO && i > 0) {
        break;
      }

      chunks.push({
        text: chunkText,
        metadata: {
          work_id: workId,
          scope: 'WORK',
          chunk_index: chunkIndex,
          ...metadata,
        },
      });

      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Chunk file content into overlapping segments
   * Similar to chunkWorkNote but for file content
   *
   * @param fileId - File ID
   * @param fileName - File name
   * @param content - File text content
   * @returns Array of text chunks with metadata
   */
  chunkFileContent(fileId: string, fileName: string, content: string): TextChunk[] {
    // Include filename for context
    const fullText = `파일명: ${fileName}\n\n${content}`;

    // Convert to pseudo-tokens (character-based approximation)
    const chunkSizeChars = this.config.chunkSize * this.CHARS_PER_TOKEN;
    const stepChars = Math.floor(chunkSizeChars * (1 - this.config.overlapRatio));

    const chunks: TextChunk[] = [];

    // If text is shorter than chunk size, return single chunk
    if (fullText.length <= chunkSizeChars) {
      chunks.push({
        text: fullText,
        metadata: {
          work_id: fileId, // Use fileId as work_id for consistency
          scope: 'FILE',
          chunk_index: 0,
          created_at_bucket: '', // Empty for file chunks
        },
      });
      return chunks;
    }

    // Sliding window chunking with overlap
    let chunkIndex = 0;
    for (let i = 0; i < fullText.length; i += stepChars) {
      const chunkText = fullText.slice(i, i + chunkSizeChars);

      // Skip very small final chunks (< MIN_CHUNK_RATIO of chunk size)
      if (chunkText.length < chunkSizeChars * this.MIN_CHUNK_RATIO && i > 0) {
        break;
      }

      chunks.push({
        text: chunkText,
        metadata: {
          work_id: fileId, // Use fileId as work_id for consistency
          scope: 'FILE',
          chunk_index: chunkIndex,
          created_at_bucket: '', // Empty for file chunks
        },
      });

      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Estimate token count from text
   *
   * @param text - Text to estimate
   * @returns Approximate token count
   */
  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Extract a specific chunk text from full text
   *
   * @param fullText - Complete text to extract from
   * @param chunkIndex - Index of the chunk to extract
   * @returns Chunk text
   */
  getChunkText(fullText: string, chunkIndex: number): string {
    const chunkSizeChars = this.config.chunkSize * this.CHARS_PER_TOKEN;
    const stepChars = Math.floor(chunkSizeChars * (1 - this.config.overlapRatio));

    const startPos = chunkIndex * stepChars;
    const chunkText = fullText.slice(startPos, startPos + chunkSizeChars);

    // Truncate to reasonable display length if needed
    return chunkText.length > 500 ? `${chunkText.slice(0, 497)}...` : chunkText;
  }

  /**
   * Generate unique chunk ID for Vectorize
   *
   * @param workId - Work note ID
   * @param chunkIndex - Chunk index
   * @returns Unique chunk ID
   */
  static generateChunkId(workId: string, chunkIndex: number): string {
    return `${workId}#chunk${chunkIndex}`;
  }

  /**
   * Parse chunk ID back to work ID and chunk index
   *
   * @param chunkId - Chunk ID
   * @returns Tuple of [workId, chunkIndex]
   */
  static parseChunkId(chunkId: string): [string, number] {
    const match = chunkId.match(/^(.+?)#chunk(\d+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid chunk ID format: ${chunkId}`);
    }
    return [match[1], parseInt(match[2], 10)];
  }
}
