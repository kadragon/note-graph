// Trace: SPEC-rag-2, TASK-022, TASK-041, SPEC-refactor-embedding-service, TASK-REFACTOR-005
// Embedding processor for bulk reindexing operations

import type { D1Result } from '@cloudflare/workers-types';
import type { ChunkMetadata } from '@shared/types/search';
import type { WorkNote, WorkNoteDetail } from '@shared/types/work-note';
import { format } from 'date-fns';
import { WorkNoteRepository } from '../repositories/work-note-repository';
import type { Env } from '../types/env';
import { ChunkingService } from './chunking-service';
import { OpenAIEmbeddingService } from './openai-embedding-service';
import { VectorizeService } from './vectorize-service';

export interface ReindexResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ workId: string; error: string; reason: EmbeddingFailureReason }>;
}

export const EMBEDDING_FAILURE_REASON = {
  UNKNOWN: 'UNKNOWN',
  NOT_FOUND: 'NOT_FOUND',
  STALE_VERSION: 'STALE_VERSION',
  PREPARE_FAILED: 'PREPARE_FAILED',
  UPSERT_FAILED: 'UPSERT_FAILED',
} as const;

export type EmbeddingFailureReason =
  (typeof EMBEDDING_FAILURE_REASON)[keyof typeof EMBEDDING_FAILURE_REASON];

// OpenAI embedding API can handle up to 2048 inputs, but we use smaller batches for reliability
const MAX_CHUNKS_PER_BATCH = 100;
const VECTOR_DELETE_BATCH_SIZE = 100;

interface ChunkToEmbed {
  id: string;
  text: string;
  metadata: {
    work_id: string;
    scope: string;
    chunk_index: number;
    person_ids?: string;
    dept_name?: string;
    category?: string;
    created_at_bucket: string;
  };
  workId: string; // Track which work note this chunk belongs to
}

interface PendingChunkState {
  chunkIds: string[];
  expectedUpdatedAt: string;
}

class EmbeddingSkipError extends Error {
  constructor(
    public readonly reason: EmbeddingFailureReason,
    message: string
  ) {
    super(message);
    this.name = 'EmbeddingSkipError';
  }
}

/**
 * Embedding processor for bulk operations
 */
export class EmbeddingProcessor {
  private repository: WorkNoteRepository;
  private chunkingService: ChunkingService;
  private vectorizeService: VectorizeService;
  private embeddingService: OpenAIEmbeddingService;

  constructor(private env: Env) {
    this.repository = new WorkNoteRepository(env.DB);
    this.chunkingService = new ChunkingService();

    this.embeddingService = new OpenAIEmbeddingService(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE);
  }

  /**
   * Reindex all work notes into vector store
   * Used for initial setup or recovery
   *
   * @param batchSize - Number of notes to process per batch (default: 10)
   * @returns Reindex result statistics
   */
  async reindexAll(batchSize: number = 10): Promise<ReindexResult> {
    const result: ReindexResult = {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // Get total count
    const countResult = await this.env.DB.prepare(
      'SELECT COUNT(*) as count FROM work_notes'
    ).first<{ count: number }>();

    result.total = countResult?.count || 0;

    if (result.total === 0) {
      return result;
    }

    console.warn(`[EmbeddingProcessor] Starting reindex of ${result.total} work notes`);

    // Process in batches using keyset pagination for better performance
    let lastCreatedAt: string | null = null;

    while (result.processed < result.total) {
      // Use keyset pagination instead of OFFSET for better performance on large datasets
      const query = lastCreatedAt
        ? `SELECT work_id as workId, title, content_raw as contentRaw,
                  category, created_at as createdAt, updated_at as updatedAt,
                  embedded_at as embeddedAt
           FROM work_notes
           WHERE created_at > ?
           ORDER BY created_at ASC
           LIMIT ?`
        : `SELECT work_id as workId, title, content_raw as contentRaw,
                  category, created_at as createdAt, updated_at as updatedAt,
                  embedded_at as embeddedAt
           FROM work_notes
           ORDER BY created_at ASC
           LIMIT ?`;

      const workNotes: D1Result<WorkNote> = lastCreatedAt
        ? await this.env.DB.prepare(query).bind(lastCreatedAt, batchSize).all<WorkNote>()
        : await this.env.DB.prepare(query).bind(batchSize).all<WorkNote>();

      const notes: WorkNote[] = workNotes.results || [];

      if (notes.length === 0) {
        break;
      }

      // Batch fetch all details upfront to avoid N+1 queries
      const workIds = notes.map((wn) => wn.workId);
      const detailsMap = await this.repository.findByIdsWithDetails(workIds);

      for (const workNote of notes) {
        result.processed++;

        try {
          // Get pre-fetched details
          const details = detailsMap.get(workNote.workId);

          // Prepare chunks using batch-fetched details
          const chunks = this.prepareWorkNoteChunksWithDetails(workNote, details);
          const chunksToEmbed = chunks.map((chunk) => ({
            id: chunk.id,
            text: chunk.text,
            metadata: chunk.metadata,
          }));
          const previousChunkCount = await this.getMaxKnownChunkCount(
            workNote.workId,
            chunksToEmbed.length
          );

          // Upsert chunks into Vectorize
          await this.upsertChunks(chunksToEmbed);

          // Delete stale chunks deterministically
          await this.deleteStaleChunks(workNote.workId, chunksToEmbed.length, previousChunkCount);

          // Update embedded_at timestamp
          await this.repository.updateEmbeddedAt(workNote.workId);

          result.succeeded++;

          if (result.processed % 10 === 0) {
            console.warn(`[EmbeddingProcessor] Progress: ${result.processed}/${result.total}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.failed++;
          result.errors.push({
            workId: workNote.workId,
            error: errorMessage,
            reason: this.classifyFailureReason(error),
          });

          console.error(`[EmbeddingProcessor] Failed to embed ${workNote.workId}: ${errorMessage}`);
          // Note: Failed embeddings will have NULL embedded_at and can be retried via /admin/embed-pending
        }
      }

      // Update cursor for next batch
      const lastNote = notes[notes.length - 1];
      if (lastNote) {
        lastCreatedAt = lastNote.createdAt;
      }
    }

    console.warn(
      `[EmbeddingProcessor] Reindex complete: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`
    );

    return result;
  }

  /**
   * Reindex a single work note
   *
   * @param workId - Work note ID to reindex
   */
  async reindexOne(workId: string): Promise<void> {
    const workNote = await this.repository.findById(workId);

    if (!workNote) {
      throw new Error(`Work note ${workId} not found`);
    }

    await this.embedWorkNote(workNote);
  }

  /**
   * Embed a work note into vector store
   * Shared logic for retry processing and bulk reindex
   */
  private async embedWorkNote(workNote: WorkNote): Promise<void> {
    // Get work note details for person_ids and dept_name
    const details = await this.repository.findByIdWithDetails(workNote.workId);
    const personIds = details?.persons.map((p) => p.personId) || [];
    const deptName = await this.repository.getDeptNameForPerson(personIds[0] || '');

    const metadata = {
      person_ids: personIds.length > 0 ? VectorizeService.encodePersonIds(personIds) : undefined,
      dept_name: deptName || undefined,
      category: workNote.category || undefined,
      created_at_bucket: format(new Date(workNote.createdAt), 'yyyy-MM-dd'),
    };

    // Chunk work note content
    const chunks = this.chunkingService.chunkWorkNote(
      workNote.workId,
      workNote.title,
      workNote.contentRaw,
      metadata
    );

    // Prepare chunks for embedding
    const chunksToEmbed = chunks.map((chunk, index) => ({
      id: ChunkingService.generateChunkId(workNote.workId, index),
      text: chunk.text,
      metadata: chunk.metadata,
    }));
    const previousChunkCount = await this.getMaxKnownChunkCount(
      workNote.workId,
      chunksToEmbed.length
    );

    // Upsert chunks into Vectorize
    await this.upsertChunks(chunksToEmbed);

    // Delete stale chunks deterministically
    await this.deleteStaleChunks(workNote.workId, chunksToEmbed.length, previousChunkCount);

    // Update embedded_at timestamp
    await this.repository.updateEmbeddedAt(workNote.workId);
  }

  /**
   * Embed only work notes that are not yet embedded
   * Uses batch processing across multiple work notes for efficiency
   *
   * @param batchSize - Number of notes to fetch per batch (default: 10)
   * @returns Reindex result statistics
   */
  async embedPending(batchSize: number = 10): Promise<ReindexResult> {
    const result: ReindexResult = {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // Get stats
    const stats = await this.repository.getEmbeddingStats();
    result.total = stats.pending;

    if (result.total === 0) {
      return result;
    }

    console.warn(
      `[EmbeddingProcessor] Starting batch embedding of ${result.total} pending work notes`
    );

    // Track failed IDs to prevent retry loops within this execution
    const failedIds = new Set<string>();

    // Collect chunks from multiple work notes
    let allChunks: ChunkToEmbed[] = [];
    let workNoteChunkMap: Map<string, PendingChunkState> = new Map();

    // Process in batches
    while (result.processed < result.total) {
      // Always fetch from offset 0 since we're updating embedded_at
      const workNotes = await this.repository.findPendingEmbedding(batchSize, 0);

      if (workNotes.length === 0) {
        break;
      }

      // Filter out failed IDs to prevent retry loops
      const validWorkNotes = workNotes.filter((wn) => !failedIds.has(wn.workId));

      if (validWorkNotes.length === 0) {
        // All fetched notes have already failed, stop to prevent infinite loop
        console.warn(`[EmbeddingProcessor] All fetched notes have failed, stopping`);
        break;
      }

      // Batch fetch all details upfront to avoid N+1 queries
      const workIds = validWorkNotes.map((wn) => wn.workId);
      const detailsMap = await this.repository.findByIdsWithDetails(workIds);

      for (const workNote of validWorkNotes) {
        try {
          // Get pre-fetched details
          const details = detailsMap.get(workNote.workId);

          // Prepare chunks for this work note using batch-fetched details
          const chunks = this.prepareWorkNoteChunksWithDetails(workNote, details);

          // Track chunk IDs for this work note
          const chunkIds = chunks.map((c) => c.id);
          workNoteChunkMap.set(workNote.workId, {
            chunkIds,
            expectedUpdatedAt: workNote.updatedAt,
          });

          // Add to batch
          allChunks.push(...chunks);

          // Process batch when we reach the limit
          if (allChunks.length >= MAX_CHUNKS_PER_BATCH) {
            const batchResult = await this.processBatch(allChunks, workNoteChunkMap);
            result.succeeded += batchResult.succeeded;
            result.failed += batchResult.failed;
            result.errors.push(...batchResult.errors);
            result.processed += batchResult.processed;

            // Track failed IDs
            for (const err of batchResult.errors) {
              failedIds.add(err.workId);
            }

            // Reset for next batch
            allChunks = [];
            workNoteChunkMap = new Map();

            console.warn(`[EmbeddingProcessor] Progress: ${result.processed}/${result.total}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.failed++;
          result.processed++;
          result.errors.push({
            workId: workNote.workId,
            error: errorMessage,
            reason: this.classifyFailureReason(error, EMBEDDING_FAILURE_REASON.PREPARE_FAILED),
          });
          failedIds.add(workNote.workId);
          console.error(
            `[EmbeddingProcessor] Failed to prepare ${workNote.workId}: ${errorMessage}`
          );
        }
      }
    }

    // Process remaining chunks
    if (allChunks.length > 0) {
      const batchResult = await this.processBatch(allChunks, workNoteChunkMap);
      result.succeeded += batchResult.succeeded;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);
      result.processed += batchResult.processed;
    }

    console.warn(
      `[EmbeddingProcessor] Batch embedding complete: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`
    );

    return result;
  }

  /**
   * Prepare chunks for a work note using pre-fetched details
   * Uses the chunking service's metadata directly instead of rebuilding
   */
  private prepareWorkNoteChunksWithDetails(
    workNote: WorkNote,
    details: WorkNoteDetail | undefined
  ): ChunkToEmbed[] {
    const personIds = details?.persons.map((p) => p.personId) || [];
    // Use first person's current department (single-department-per-note assumption)
    const deptName = details?.persons[0]?.currentDept || undefined;

    const metadata = {
      person_ids: personIds.length > 0 ? VectorizeService.encodePersonIds(personIds) : undefined,
      dept_name: deptName,
      category: workNote.category || undefined,
      created_at_bucket: format(new Date(workNote.createdAt), 'yyyy-MM-dd'),
    };

    // Chunk work note content - chunking service creates full metadata
    const chunks = this.chunkingService.chunkWorkNote(
      workNote.workId,
      workNote.title,
      workNote.contentRaw,
      metadata
    );

    // Use chunking service's metadata directly
    return chunks.map((chunk, index) => ({
      id: ChunkingService.generateChunkId(workNote.workId, index),
      text: chunk.text,
      metadata: chunk.metadata as ChunkToEmbed['metadata'],
      workId: workNote.workId,
    }));
  }

  /**
   * Process a batch of chunks from multiple work notes
   */
  private async processBatch(
    chunks: ChunkToEmbed[],
    workNoteChunkMap: Map<string, PendingChunkState>
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ workId: string; error: string; reason: EmbeddingFailureReason }>;
  }> {
    const batchResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ workId: string; error: string; reason: EmbeddingFailureReason }>,
    };

    const workIds = Array.from(workNoteChunkMap.keys());

    try {
      // Batch embed all chunks at once
      const chunksForVectorize = chunks.map((c) => ({
        id: c.id,
        text: c.text,
        metadata: c.metadata as ChunkMetadata,
      }));

      await this.upsertChunks(chunksForVectorize);

      // Update embedded_at for all work notes in this batch (in parallel)
      const updatePromises = workIds.map(async (workId) => {
        const chunkState = workNoteChunkMap.get(workId);
        if (!chunkState) {
          throw new Error(`Missing chunk state for work note ${workId}`);
        }

        const newChunkCount = chunkState.chunkIds.length;
        const previousChunkCount = await this.getMaxKnownChunkCount(workId, newChunkCount);

        // Delete stale chunks deterministically
        await this.deleteStaleChunks(workId, newChunkCount, previousChunkCount);

        // Update timestamp only if this is still the current version
        const updated = await this.repository.updateEmbeddedAtIfUpdatedAtMatches(
          workId,
          chunkState.expectedUpdatedAt
        );
        if (!updated) {
          const current = await this.repository.findById(workId);
          if (!current) {
            throw new EmbeddingSkipError(
              EMBEDDING_FAILURE_REASON.NOT_FOUND,
              `Work note ${workId} not found`
            );
          }
          throw new EmbeddingSkipError(
            EMBEDDING_FAILURE_REASON.STALE_VERSION,
            `Work note ${workId} is stale (expected ${chunkState.expectedUpdatedAt}, got ${current.updatedAt})`
          );
        }

        return workId;
      });

      const results = await Promise.allSettled(updatePromises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const workId = workIds[i];
        if (!result || !workId) continue;

        batchResult.processed++;

        if (result.status === 'fulfilled') {
          batchResult.succeeded++;
        } else {
          const errorMessage =
            result.reason instanceof Error ? result.reason.message : String(result.reason);
          batchResult.failed++;
          batchResult.errors.push({
            workId,
            error: errorMessage,
            reason: this.classifyFailureReason(result.reason),
          });
        }
      }
    } catch (error) {
      // If batch embedding fails, mark all work notes as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      for (const workId of workIds) {
        batchResult.failed++;
        batchResult.processed++;
        batchResult.errors.push({
          workId,
          error: errorMessage,
          reason: this.classifyFailureReason(error, EMBEDDING_FAILURE_REASON.UPSERT_FAILED),
        });
      }
      console.error(`[EmbeddingProcessor] Batch embedding failed: ${errorMessage}`);
    }

    return batchResult;
  }

  /**
   * Upsert chunks into Vectorize with embeddings
   * Public method for reuse across services (WorkNoteService)
   */
  async upsertChunks(
    chunks: Array<{ id: string; text: string; metadata: ChunkMetadata }>
  ): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const texts = chunks.map((chunk) => chunk.text);
    const embeddings = await this.embeddingService.embedBatch(texts);

    const vectors = chunks.map((chunk, index) => {
      const embedding = embeddings[index];
      if (!embedding) {
        throw new Error(`Missing embedding for chunk ${chunk.id}`);
      }
      return {
        id: chunk.id,
        values: embedding,
        metadata: VectorizeService.encodeMetadata(chunk.metadata),
      };
    });

    await this.vectorizeService.insert(vectors);
  }

  /**
   * Delete stale chunks for a work note by deterministic chunk ID range.
   * Public method for reuse across services (WorkNoteService)
   */
  async deleteStaleChunks(
    workId: string,
    newChunkCount: number,
    previousChunkCount: number
  ): Promise<void> {
    try {
      if (previousChunkCount > newChunkCount) {
        await this.deleteChunkRange(workId, newChunkCount, previousChunkCount);
      }
    } catch (error) {
      console.error('Error deleting stale chunks:', error);
      // Non-fatal: log and continue
    }
  }

  estimateChunkCount(workId: string, title: string, contentRaw: string): number {
    return this.chunkingService.chunkWorkNote(workId, title, contentRaw, { created_at_bucket: '' })
      .length;
  }

  async getMaxKnownChunkCount(workId: string, fallbackCount: number): Promise<number> {
    if (fallbackCount <= 0) {
      return fallbackCount;
    }

    try {
      const versions = await this.repository.getVersions(workId);
      let maxChunkCount = fallbackCount;

      for (const version of versions) {
        maxChunkCount = Math.max(
          maxChunkCount,
          this.estimateChunkCount(workId, version.title, version.contentRaw)
        );
      }

      return maxChunkCount;
    } catch (error) {
      console.warn('[EmbeddingProcessor] Failed to inspect versions for chunk cleanup:', {
        workId,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallbackCount;
    }
  }

  private buildChunkIds(workId: string, startIndex: number, endExclusive: number): string[] {
    const chunkIds: string[] = [];
    for (let index = startIndex; index < endExclusive; index++) {
      chunkIds.push(ChunkingService.generateChunkId(workId, index));
    }
    return chunkIds;
  }

  async deleteChunkIdsInBatches(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) {
      return;
    }

    for (let i = 0; i < chunkIds.length; i += VECTOR_DELETE_BATCH_SIZE) {
      const batch = chunkIds.slice(i, i + VECTOR_DELETE_BATCH_SIZE);
      await this.vectorizeService.delete(batch);
    }
  }

  async deleteChunkRange(workId: string, startIndex: number, endExclusive: number): Promise<void> {
    if (endExclusive <= startIndex) {
      return;
    }

    await this.deleteChunkIdsInBatches(this.buildChunkIds(workId, startIndex, endExclusive));
  }

  private classifyFailureReason(
    error: unknown,
    fallback: EmbeddingFailureReason = EMBEDDING_FAILURE_REASON.UNKNOWN
  ): EmbeddingFailureReason {
    if (error instanceof EmbeddingSkipError) {
      return error.reason;
    }
    return fallback;
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{ total: number; embedded: number; pending: number }> {
    return this.repository.getEmbeddingStats();
  }
}
