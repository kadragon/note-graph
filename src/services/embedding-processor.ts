// Trace: SPEC-rag-2, TASK-022
// Embedding processor for bulk reindexing operations

import type { D1Result } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import type { WorkNote } from '../types/work-note';
import { WorkNoteRepository } from '../repositories/work-note-repository';
import { ChunkingService } from './chunking-service';
import { EmbeddingService, VectorizeService } from './embedding-service';
import { format } from 'date-fns';

export interface ReindexResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ workId: string; error: string }>;
}

// OpenAI embedding API can handle up to 2048 inputs, but we use smaller batches for reliability
const MAX_CHUNKS_PER_BATCH = 100;

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

/**
 * Embedding processor for bulk operations
 */
export class EmbeddingProcessor {
  private repository: WorkNoteRepository;
  private chunkingService: ChunkingService;
  private vectorizeService: VectorizeService;

  constructor(private env: Env) {
    this.repository = new WorkNoteRepository(env.DB);
    this.chunkingService = new ChunkingService();

    const embeddingService = new EmbeddingService(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE, embeddingService);
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
    const countResult = await this.env.DB
      .prepare('SELECT COUNT(*) as count FROM work_notes')
      .first<{ count: number }>();

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

      for (const workNote of notes) {
        result.processed++;

        try {
          await this.embedWorkNote(workNote);
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

    console.warn(`[EmbeddingProcessor] Reindex complete: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`);

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

    // Upsert chunks into Vectorize
    await this.vectorizeService.upsertChunks(chunksToEmbed);

    // Delete stale chunks (if this is a re-embed)
    const newChunkIds = new Set(chunksToEmbed.map((c) => c.id));
    await this.vectorizeService.deleteStaleChunks(workNote.workId, newChunkIds);

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

    console.warn(`[EmbeddingProcessor] Starting batch embedding of ${result.total} pending work notes`);

    // Collect chunks from multiple work notes
    let allChunks: ChunkToEmbed[] = [];
    let workNoteChunkMap: Map<string, string[]> = new Map(); // workId -> chunkIds

    // Process in batches
    while (result.processed < result.total) {
      // Always fetch from offset 0 since we're updating embedded_at
      const workNotes = await this.repository.findPendingEmbedding(batchSize, 0);

      if (workNotes.length === 0) {
        break;
      }

      for (const workNote of workNotes) {
        try {
          // Prepare chunks for this work note
          const chunks = await this.prepareWorkNoteChunks(workNote);

          // Track chunk IDs for this work note
          const chunkIds = chunks.map(c => c.id);
          workNoteChunkMap.set(workNote.workId, chunkIds);

          // Add to batch
          allChunks.push(...chunks);

          // Process batch when we reach the limit
          if (allChunks.length >= MAX_CHUNKS_PER_BATCH) {
            const batchResult = await this.processBatch(allChunks, workNoteChunkMap);
            result.succeeded += batchResult.succeeded;
            result.failed += batchResult.failed;
            result.errors.push(...batchResult.errors);
            result.processed += batchResult.processed;

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
          });
          console.error(`[EmbeddingProcessor] Failed to prepare ${workNote.workId}: ${errorMessage}`);
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

    console.warn(`[EmbeddingProcessor] Batch embedding complete: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`);

    return result;
  }

  /**
   * Prepare chunks for a work note without embedding
   */
  private async prepareWorkNoteChunks(workNote: WorkNote): Promise<ChunkToEmbed[]> {
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
    return chunks.map((chunk, index) => ({
      id: ChunkingService.generateChunkId(workNote.workId, index),
      text: chunk.text,
      metadata: {
        work_id: workNote.workId,
        scope: 'WORK',
        chunk_index: index,
        ...metadata,
      },
      workId: workNote.workId,
    }));
  }

  /**
   * Process a batch of chunks from multiple work notes
   */
  private async processBatch(
    chunks: ChunkToEmbed[],
    workNoteChunkMap: Map<string, string[]>
  ): Promise<{ processed: number; succeeded: number; failed: number; errors: Array<{ workId: string; error: string }> }> {
    const batchResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ workId: string; error: string }>,
    };

    const workIds = Array.from(workNoteChunkMap.keys());

    try {
      // Batch embed all chunks at once
      const chunksForVectorize = chunks.map(c => ({
        id: c.id,
        text: c.text,
        metadata: c.metadata as import('../types/search').ChunkMetadata,
      }));

      await this.vectorizeService.upsertChunks(chunksForVectorize);

      // Update embedded_at for all work notes in this batch
      for (const workId of workIds) {
        try {
          // Delete stale chunks
          const newChunkIds = new Set(workNoteChunkMap.get(workId) || []);
          await this.vectorizeService.deleteStaleChunks(workId, newChunkIds);

          // Update timestamp
          await this.repository.updateEmbeddedAt(workId);
          batchResult.succeeded++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          batchResult.failed++;
          batchResult.errors.push({ workId, error: errorMessage });
        }
        batchResult.processed++;
      }
    } catch (error) {
      // If batch embedding fails, mark all work notes as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      for (const workId of workIds) {
        batchResult.failed++;
        batchResult.processed++;
        batchResult.errors.push({ workId, error: errorMessage });
      }
      console.error(`[EmbeddingProcessor] Batch embedding failed: ${errorMessage}`);
    }

    return batchResult;
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{ total: number; embedded: number; pending: number }> {
    return this.repository.getEmbeddingStats();
  }
}
