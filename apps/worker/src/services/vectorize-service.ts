// Trace: SPEC-refactor-embedding-service, TASK-REFACTOR-005

import type { ChunkMetadata } from '@shared/types/search';

export interface VectorizeQueryOptions {
  topK: number;
  filter?: Record<string, string>;
  returnMetadata: boolean;
}

export interface VectorizeQueryResult {
  matches: Array<{ id: string; score: number; metadata?: unknown }>;
}

export class VectorizeService {
  constructor(private vectorize: VectorizeIndex) {}

  async insert(
    vectors: Array<{ id: string; values: number[]; metadata?: Record<string, string> }>
  ): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    await this.vectorize.upsert(vectors);
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.vectorize.deleteByIds(ids);
  }

  async query(embedding: number[], options: VectorizeQueryOptions): Promise<VectorizeQueryResult> {
    return this.vectorize.query(embedding, options) as Promise<VectorizeQueryResult>;
  }

  /**
   * Encode metadata to fit within Vectorize limits
   * Vectorize has strict limits: string fields must be < 64 bytes
   */
  static encodeMetadata(metadata: ChunkMetadata): Record<string, string> {
    const encoded: Record<string, string> = {
      work_id: metadata.work_id,
      scope: metadata.scope,
      chunk_index: metadata.chunk_index.toString(),
    };

    if (metadata.person_ids) {
      encoded.person_ids = VectorizeService.encodePersonIdsWithLimit(metadata.person_ids, 60);
    }

    if (metadata.dept_name) {
      encoded.dept_name = VectorizeService.truncateToBytes(metadata.dept_name, 60);
    }

    if (metadata.category) {
      encoded.category = VectorizeService.truncateToBytes(metadata.category, 60);
    }

    if (metadata.created_at_bucket) {
      encoded.created_at_bucket = metadata.created_at_bucket;
    }

    if (metadata.project_id) {
      encoded.project_id = metadata.project_id;
    }

    return encoded;
  }

  /**
   * Encode person IDs into compact string format
   */
  static encodePersonIds(personIds: string[]): string {
    return personIds.join(',');
  }

  /**
   * Decode person IDs from compact string format
   */
  static decodePersonIds(encoded: string): string[] {
    return encoded ? encoded.split(',') : [];
  }

  private static truncateToBytes(str: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);

    if (encoded.length <= maxBytes) {
      return str;
    }

    let cutIndex = maxBytes;
    while (cutIndex > 0) {
      const byte = encoded[cutIndex];
      if (byte !== undefined && (byte & 0xc0) === 0x80) {
        cutIndex--;
      } else {
        break;
      }
    }

    const decoder = new TextDecoder('utf-8');
    return decoder.decode(encoded.slice(0, cutIndex));
  }

  private static encodePersonIdsWithLimit(personIdsString: string, maxBytes: number): string {
    const personIds = personIdsString.split(',');
    const result: string[] = [];
    let currentLength = 0;

    for (const id of personIds) {
      const addition = result.length === 0 ? id : `,${id}`;
      const encoder = new TextEncoder();
      const newLength = currentLength + encoder.encode(addition).length;

      if (newLength <= maxBytes) {
        result.push(id);
        currentLength = newLength;
      } else {
        break;
      }
    }

    return result.join(',');
  }
}
