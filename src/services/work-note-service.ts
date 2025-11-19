// Trace: SPEC-rag-1, SPEC-rag-2, TASK-012, TASK-022
/**
 * Work note service coordinating D1, chunking, and embedding operations
 * Now includes embedding retry mechanism for eventual consistency
 */

import type { Env } from '../types/env';
import type { WorkNote, WorkNoteDetail } from '../types/work-note';
import type { CreateWorkNoteInput, UpdateWorkNoteInput, ListWorkNotesQuery } from '../schemas/work-note';
import { WorkNoteRepository } from '../repositories/work-note-repository';
import { ChunkingService } from './chunking-service';
import { EmbeddingService, VectorizeService } from './embedding-service';
import { EmbeddingRetryService } from './embedding-retry-service';
import { format } from 'date-fns';

/**
 * Work note service with integrated RAG support and embedding retry
 *
 * Coordinates:
 * - D1 operations via WorkNoteRepository
 * - Text chunking via ChunkingService
 * - Vector embeddings via VectorizeService
 * - Embedding retry via EmbeddingRetryService
 */
export class WorkNoteService {
  private repository: WorkNoteRepository;
  private chunkingService: ChunkingService;
  private vectorizeService: VectorizeService;
  private retryService: EmbeddingRetryService;

  constructor(env: Env) {
    this.repository = new WorkNoteRepository(env.DB);
    this.chunkingService = new ChunkingService();

    const embeddingService = new EmbeddingService(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE, embeddingService);
    this.retryService = new EmbeddingRetryService(env.DB);
  }

  /**
   * Find work note by ID
   */
  async findById(workId: string): Promise<WorkNote | null> {
    return this.repository.findById(workId);
  }

  /**
   * Find work note by ID with all associations
   */
  async findByIdWithDetails(workId: string): Promise<WorkNoteDetail | null> {
    return this.repository.findByIdWithDetails(workId);
  }

  /**
   * Find all work notes with filters
   */
  async findAll(query: ListWorkNotesQuery): Promise<WorkNoteDetail[]> {
    return this.repository.findAll(query);
  }

  /**
   * Create work note with automatic chunking and embedding
   * Failures are automatically enqueued for retry
   */
  async create(data: CreateWorkNoteInput): Promise<WorkNote> {
    // Create work note in D1
    const workNote = await this.repository.create(data);

    // Chunk and embed for RAG (async, non-blocking)
    this.chunkAndEmbedWorkNote(workNote, data).catch(async (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };

      console.error('[CRITICAL] Failed to chunk and embed work note, enqueueing for retry:', {
        workId: workNote.workId,
        title: workNote.title,
        ...errorDetails,
      });

      // Enqueue for automatic retry with exponential backoff
      try {
        await this.retryService.enqueueRetry(
          workNote.workId,
          'create',
          errorMessage,
          errorDetails
        );
        console.log('[RETRY] Embedding failure enqueued for work note:', workNote.workId);
      } catch (retryError) {
        console.error('[CRITICAL] Failed to enqueue retry:', {
          workId: workNote.workId,
          retryError: retryError instanceof Error ? retryError.message : String(retryError),
        });
      }
    });

    return workNote;
  }

  /**
   * Update work note with automatic chunking and embedding
   * Failures are automatically enqueued for retry
   */
  async update(workId: string, data: UpdateWorkNoteInput): Promise<WorkNote> {
    // Update work note in D1
    const workNote = await this.repository.update(workId, data);

    // Re-chunk and re-embed for RAG (async, non-blocking)
    this.rechunkAndEmbedWorkNote(workNote, data).catch(async (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };

      console.error('[CRITICAL] Failed to re-chunk and embed work note, enqueueing for retry:', {
        workId: workNote.workId,
        title: workNote.title,
        ...errorDetails,
      });

      // Enqueue for automatic retry with exponential backoff
      try {
        await this.retryService.enqueueRetry(
          workNote.workId,
          'update',
          errorMessage,
          errorDetails
        );
        console.log('[RETRY] Re-embedding failure enqueued for work note:', workNote.workId);
      } catch (retryError) {
        console.error('[CRITICAL] Failed to enqueue retry:', {
          workId: workNote.workId,
          retryError: retryError instanceof Error ? retryError.message : String(retryError),
        });
      }
    });

    return workNote;
  }

  /**
   * Delete work note and remove embeddings
   * Failures are automatically enqueued for retry
   */
  async delete(workId: string): Promise<void> {
    // Delete from D1 (this also cascades delete to retry queue via FK)
    await this.repository.delete(workId);

    // Delete chunks from Vectorize (async, non-blocking)
    // Note: Retry queue entries are automatically deleted via CASCADE
    this.vectorizeService.deleteWorkNoteChunks(workId).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[WARNING] Failed to delete work note chunks:', {
        workId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Note: Since work note is already deleted from D1, we cannot enqueue for retry
      // (FK constraint would fail). Orphaned embeddings will remain but won't affect functionality.
      // Future enhancement: Implement orphan cleanup job
    });
  }

  /**
   * Get versions for a work note
   */
  async getVersions(workId: string) {
    return this.repository.getVersions(workId);
  }

  /**
   * Chunk and embed work note for RAG
   */
  private async chunkAndEmbedWorkNote(workNote: WorkNote, data: CreateWorkNoteInput): Promise<void> {
    // Extract metadata for chunking
    const personIds = data.persons?.map((p) => p.personId) || [];
    const deptName = await this.getDeptNameFromPersons(personIds);

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
  }

  /**
   * Re-chunk and re-embed work note after update
   *
   * Uses atomic upsert-first strategy to prevent data loss:
   * 1. Upsert new chunks (preserves old chunks if this fails)
   * 2. Delete stale chunks only after successful upsert
   */
  private async rechunkAndEmbedWorkNote(workNote: WorkNote, data: UpdateWorkNoteInput): Promise<void> {
    // Get person IDs (use updated data if provided, otherwise fetch from DB)
    let personIds: string[] = [];
    if (data.persons !== undefined) {
      personIds = data.persons.map((p) => p.personId);
    } else {
      const details = await this.repository.findByIdWithDetails(workNote.workId);
      personIds = details?.persons.map((p) => p.personId) || [];
    }

    const deptName = await this.getDeptNameFromPersons(personIds);

    const metadata = {
      person_ids: personIds.length > 0 ? VectorizeService.encodePersonIds(personIds) : undefined,
      dept_name: deptName || undefined,
      category: workNote.category || undefined,
      created_at_bucket: format(new Date(workNote.createdAt), 'yyyy-MM-dd'),
    };

    // Chunk updated work note content
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

    // ATOMIC: Upsert new chunks first (preserves old chunks if this fails)
    await this.vectorizeService.upsertChunks(chunksToEmbed);

    // Only delete stale chunks after successful upsert
    // Note: Vectorize upsert replaces chunks with same ID, so we only need to
    // delete chunks that exceed the new chunk count
    const newChunkIds = new Set(chunksToEmbed.map((c) => c.id));
    await this.vectorizeService.deleteStaleChunks(workNote.workId, newChunkIds);
  }

  /**
   * Get department name from person IDs
   *
   * Uses the first person's current department
   */
  private async getDeptNameFromPersons(personIds: string[]): Promise<string | null> {
    if (personIds.length === 0 || !personIds[0]) {
      return null;
    }

    // Get first person's department via repository
    return this.repository.getDeptNameForPerson(personIds[0]);
  }

  /**
   * Find similar work notes based on input text
   *
   * Searches for similar work notes using vector similarity and returns
   * basic information (title, content, category) suitable for AI context.
   *
   * @param inputText - Text to find similar notes for
   * @param topK - Number of similar notes to return (default: 3)
   * @param scoreThreshold - Minimum similarity score (default: 0.5)
   * @returns Array of similar notes with title, content, and category
   */
  async findSimilarNotes(
    inputText: string,
    topK: number = 3,
    scoreThreshold: number = 0.5
  ): Promise<Array<{ title: string; content: string; category?: string }>> {
    try {
      // Search for similar work notes
      const similarResults = await this.vectorizeService.search(inputText, topK);

      // Filter by similarity threshold and extract work IDs
      const relevantResults = similarResults.filter((r) => r.score >= scoreThreshold);
      const workIds = [...new Set(
        relevantResults
          .map((r) => r.id?.split('#')[0])
          .filter((id): id is string => id !== undefined)
      )]; // Handle chunk IDs, deduplicate

      if (workIds.length === 0) {
        return [];
      }

      // Batch fetch work notes (solves N+1 query problem)
      const workNotes = await this.repository.findByIds(workIds);

      // Map results maintaining similarity order
      const workNoteMap = new Map(
        workNotes.map((note) => [note.workId, note])
      );

      return workIds
        .map((id) => workNoteMap.get(id))
        .filter((note): note is WorkNote => note !== undefined)
        .map((note) => ({
          title: note.title,
          content: note.contentRaw,
          category: note.category || undefined,
        }));
    } catch (error) {
      console.error('[WorkNoteService] Error finding similar notes:', error);
      return [];
    }
  }
}
