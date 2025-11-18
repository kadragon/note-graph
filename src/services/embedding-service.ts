// Trace: SPEC-search-1, TASK-010
import type { Env } from '../types/env';
import type { ChunkMetadata } from '../types/search';

/**
 * Embedding service using OpenAI text-embedding-3-small via AI Gateway
 */
export class EmbeddingService {
  constructor(private env: Env) {}

  /**
   * Generate embedding for a single text
   *
   * @param text - Text to embed
   * @returns Embedding vector (1536 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.callOpenAI([text]);
    if (!response.data[0]) {
      throw new Error('No embedding returned from OpenAI API');
    }
    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts in batch
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await this.callOpenAI(texts);
    return response.data.map((item: { embedding: number[] }) => item.embedding);
  }

  /**
   * Call OpenAI API via AI Gateway
   *
   * @param inputs - Array of texts to embed
   * @returns OpenAI API response
   */
  private async callOpenAI(inputs: string[]): Promise<{
    data: Array<{ embedding: number[]; index: number }>;
  }> {
    const url = `https://gateway.ai.cloudflare.com/v1/${this.env.AI_GATEWAY_ID}/openai/embeddings`;

    const requestBody = {
      model: this.env.OPENAI_MODEL_EMBEDDING,
      input: inputs,
      encoding_format: 'float',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error('AI_RATE_LIMIT: Embedding rate limit exceeded');
      }
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data as { data: Array<{ embedding: number[]; index: number }> };
  }
}

/**
 * Vectorize service for managing vector embeddings
 */
export class VectorizeService {
  constructor(
    private vectorize: VectorizeIndex,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Upsert work note embedding into Vectorize
   * Creates embedding for work note and stores with metadata
   *
   * @param workId - Work note ID
   * @param title - Work note title
   * @param content - Work note content
   * @param metadata - Additional metadata (person_ids, dept_name, category, etc.)
   */
  async upsertWorkNote(
    workId: string,
    title: string,
    content: string,
    metadata: Omit<ChunkMetadata, 'work_id' | 'scope' | 'chunk_index'>
  ): Promise<void> {
    // Combine title and content for embedding
    const text = `${title}\n\n${content}`;

    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(text);

    // Encode metadata to fit within Vectorize limits (64 bytes per string field)
    const encodedMetadata = this.encodeMetadata({
      work_id: workId,
      scope: 'WORK',
      chunk_index: 0,
      ...metadata,
    });

    // Upsert into Vectorize
    await this.vectorize.upsert([
      {
        id: workId,
        values: embedding,
        metadata: encodedMetadata,
      },
    ]);
  }

  /**
   * Delete work note embedding from Vectorize
   *
   * @param workId - Work note ID
   */
  async deleteWorkNote(workId: string): Promise<void> {
    await this.vectorize.deleteByIds([workId]);
  }

  /**
   * Search for similar work notes using vector similarity
   *
   * @param query - Search query text
   * @param topK - Number of results to return
   * @param filter - Optional metadata filter
   * @returns Array of search results with scores
   */
  async search(
    query: string,
    topK: number = 10,
    filter?: Record<string, string>
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, string> }>> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Search Vectorize
    const results = await this.vectorize.query(queryEmbedding, {
      topK,
      filter,
      returnMetadata: true,
    });

    return results.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as Record<string, string>,
    }));
  }

  /**
   * Truncate string to maximum byte length while respecting UTF-8 boundaries
   *
   * @param str - String to truncate
   * @param maxBytes - Maximum byte length
   * @returns Truncated string
   */
  private truncateToBytes(str: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);

    if (encoded.length <= maxBytes) {
      return str;
    }

    let cutIndex = maxBytes;
    // Ensure we don't cut in the middle of a multi-byte character
    // Check if we're in the middle of a UTF-8 multi-byte sequence (0x80-0xBF)
    while (cutIndex > 0) {
      const byte = encoded[cutIndex];
      if (byte !== undefined && (byte & 0xC0) === 0x80) {
        cutIndex--;
      } else {
        break;
      }
    }

    const decoder = new TextDecoder('utf-8');
    return decoder.decode(encoded.slice(0, cutIndex));
  }

  /**
   * Encode person IDs to fit within byte limit without corruption
   * Only includes complete IDs that fit within the limit
   *
   * @param personIdsString - Comma-separated person IDs
   * @param maxBytes - Maximum byte length (default 60)
   * @returns Encoded person IDs string
   */
  private encodePersonIdsWithLimit(personIdsString: string, maxBytes: number = 60): string {
    const personIds = personIdsString.split(',');
    const result: string[] = [];
    let currentLength = 0;

    for (const id of personIds) {
      // Calculate length with comma separator (except for first item)
      const addition = result.length === 0 ? id : `,${id}`;
      const encoder = new TextEncoder();
      const newLength = currentLength + encoder.encode(addition).length;

      if (newLength <= maxBytes) {
        result.push(id);
        currentLength = newLength;
      } else {
        // Stop adding if we exceed the limit
        break;
      }
    }

    return result.join(',');
  }

  /**
   * Encode metadata to fit within Vectorize limits
   * Vectorize has strict limits: string fields must be < 64 bytes
   *
   * @param metadata - Chunk metadata
   * @returns Encoded metadata
   */
  private encodeMetadata(metadata: ChunkMetadata): Record<string, string> {
    const encoded: Record<string, string> = {
      work_id: metadata.work_id,
      scope: metadata.scope,
      chunk_index: metadata.chunk_index.toString(),
    };

    // Add optional fields if present and within limits
    if (metadata.person_ids) {
      // Encode person IDs without corruption - only include complete IDs
      encoded.person_ids = this.encodePersonIdsWithLimit(metadata.person_ids, 60);
    }

    if (metadata.dept_name) {
      // Truncate based on byte length, not character count
      encoded.dept_name = this.truncateToBytes(metadata.dept_name, 60);
    }

    if (metadata.category) {
      // Truncate based on byte length, not character count
      encoded.category = this.truncateToBytes(metadata.category, 60);
    }

    if (metadata.created_at_bucket) {
      // Date bucket is always 10 bytes (YYYY-MM-DD)
      encoded.created_at_bucket = metadata.created_at_bucket;
    }

    return encoded;
  }

  /**
   * Encode person IDs into compact string format
   * Uses comma-separated list, truncated if needed
   *
   * @param personIds - Array of person IDs
   * @returns Compact string representation
   */
  static encodePersonIds(personIds: string[]): string {
    return personIds.join(',');
  }

  /**
   * Decode person IDs from compact string format
   *
   * @param encoded - Encoded person IDs string
   * @returns Array of person IDs
   */
  static decodePersonIds(encoded: string): string[] {
    return encoded ? encoded.split(',') : [];
  }
}
