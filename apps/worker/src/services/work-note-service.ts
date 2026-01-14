// Trace: SPEC-rag-1, SPEC-rag-2, SPEC-ai-draft-refs-1, SPEC-worknote-attachments-1, TASK-012, TASK-022, TASK-029, TASK-057, SPEC-refactor-embedding-service, TASK-REFACTOR-005
/**
 * Work note service coordinating D1, chunking, embedding, and file operations
 * Uses embedded_at tracking for embedding state management
 */

import type { SimilarWorkNoteReference } from '@shared/types/search';
import type { WorkNote, WorkNoteDetail } from '@shared/types/work-note';
import { format } from 'date-fns';
import { WorkNoteRepository } from '../repositories/work-note-repository';
import type {
  CreateWorkNoteInput,
  ListWorkNotesQuery,
  UpdateWorkNoteInput,
} from '../schemas/work-note';
import type { Env } from '../types/env';
import { ChunkingService } from './chunking-service';
import { EmbeddingProcessor } from './embedding-processor';
import { OpenAIEmbeddingService } from './openai-embedding-service';
import { VectorizeService } from './vectorize-service';
import { WorkNoteFileService } from './work-note-file-service';

/**
 * Work note service with integrated RAG support and file attachments
 *
 * Coordinates:
 * - D1 operations via WorkNoteRepository
 * - Text chunking via ChunkingService
 * - Vector embeddings via VectorizeService
 * - File attachments via WorkNoteFileService
 */
export class WorkNoteService {
  private repository: WorkNoteRepository;
  private chunkingService: ChunkingService;
  private vectorizeService: VectorizeService;
  private embeddingService: OpenAIEmbeddingService;
  private embeddingProcessor: EmbeddingProcessor;
  private fileService: WorkNoteFileService | null;

  constructor(env: Env) {
    this.repository = new WorkNoteRepository(env.DB);
    this.chunkingService = new ChunkingService();

    this.embeddingService = new OpenAIEmbeddingService(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE);
    this.embeddingProcessor = new EmbeddingProcessor(env);

    // Initialize file service only when Google Drive credentials are configured
    const hasGoogleDrive = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    this.fileService =
      env.R2_BUCKET && hasGoogleDrive ? new WorkNoteFileService(env.R2_BUCKET, env.DB, env) : null;
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
   * D1 write always succeeds; embedding failures are logged but don't fail the operation
   *
   * @param data - Work note creation data
   * @param options - Options for embedding (skipEmbedding to defer to background)
   * @returns Work note and optional embedding promise for background processing
   */
  async create(
    data: CreateWorkNoteInput,
    options?: { skipEmbedding?: boolean }
  ): Promise<{ workNote: WorkNote; embeddingPromise?: Promise<void> }> {
    const workNote = await this.repository.create(data);
    const embeddingResult = await this.handleEmbedding(
      this.chunkAndEmbedWorkNote(workNote, data),
      workNote,
      options?.skipEmbedding
    );
    return { workNote, ...embeddingResult };
  }

  /**
   * Update work note with automatic chunking and embedding
   * D1 write always succeeds; embedding failures are logged but don't fail the operation
   *
   * @param workId - Work note ID to update
   * @param data - Work note update data
   * @param options - Options for embedding (skipEmbedding to defer to background)
   * @returns Work note and optional embedding promise for background processing
   */
  async update(
    workId: string,
    data: UpdateWorkNoteInput,
    options?: { skipEmbedding?: boolean }
  ): Promise<{ workNote: WorkNote; embeddingPromise?: Promise<void> }> {
    const workNote = await this.repository.update(workId, data);
    const embeddingResult = await this.handleEmbedding(
      this.rechunkAndEmbedWorkNote(workNote, data),
      workNote,
      options?.skipEmbedding
    );
    return { workNote, ...embeddingResult };
  }

  /**
   * Delete work note, remove embeddings, and delete attached files
   */
  async delete(workId: string, userEmail?: string): Promise<void> {
    // Delete attached files from R2 and DB (async, non-blocking)
    if (this.fileService) {
      this.fileService.deleteWorkNoteFiles(workId, userEmail).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error('[WorkNoteService] Failed to delete work note files:', {
          workId,
          error: errorMessage,
        });
        // Note: Files may remain but work note will be deleted
      });
    }

    // Delete from D1 (cascade will handle work_note_files via ON DELETE CASCADE)
    await this.repository.delete(workId);

    // Delete chunks from Vectorize (async, non-blocking)
    this.deleteWorkNoteChunks(workId).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[WorkNoteService] Failed to delete work note chunks:', {
        workId,
        error: errorMessage,
      });
      // Note: Orphaned embeddings may remain but won't affect functionality
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
  private async chunkAndEmbedWorkNote(
    workNote: WorkNote,
    data: CreateWorkNoteInput
  ): Promise<void> {
    const personIds = data.persons?.map((p) => p.personId) || [];
    await this.performChunkingAndEmbedding(workNote, personIds, false);
  }

  /**
   * Re-chunk and re-embed work note after update
   *
   * Uses atomic upsert-first strategy to prevent data loss:
   * 1. Upsert new chunks (preserves old chunks if this fails)
   * 2. Delete stale chunks only after successful upsert
   */
  private async rechunkAndEmbedWorkNote(
    workNote: WorkNote,
    data: UpdateWorkNoteInput
  ): Promise<void> {
    // Get person IDs (use updated data if provided, otherwise fetch from DB)
    let personIds: string[] = [];
    if (data.persons !== undefined) {
      personIds = data.persons.map((p) => p.personId);
    } else {
      const details = await this.repository.findByIdWithDetails(workNote.workId);
      personIds = details?.persons.map((p) => p.personId) || [];
    }

    await this.performChunkingAndEmbedding(workNote, personIds, true);
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
   * Handle embedding task with optional background processing
   * Wraps embedding with error handling and logging
   *
   * @param embeddingTask - The embedding promise to execute
   * @param workNote - Work note being embedded
   * @param skipEmbedding - If true, returns promise for background execution; if false, awaits synchronously
   * @returns Object with optional embeddingPromise for background processing
   */
  private async handleEmbedding(
    embeddingTask: Promise<void>,
    workNote: WorkNote,
    skipEmbedding?: boolean
  ): Promise<{ embeddingPromise?: Promise<void> }> {
    const wrappedTask = embeddingTask.catch((error) => {
      this.logEmbeddingError(workNote, error);
    });

    if (skipEmbedding) {
      return { embeddingPromise: wrappedTask };
    }

    await wrappedTask;
    return {};
  }

  /**
   * Log embedding error with work note context
   * Used for both create and update operations
   *
   * @param workNote - Work note that failed to embed
   * @param error - The error that occurred
   */
  private logEmbeddingError(workNote: WorkNote, error: unknown): void {
    console.error('[WorkNoteService] Failed to embed work note:', {
      workId: workNote.workId,
      title: workNote.title,
      error: error instanceof Error ? error.message : String(error),
    });
    // Note: embedded_at remains NULL and can be retried via /admin/embed-pending
  }

  /**
   * Common chunking and embedding logic
   * Shared between create, update, and reembedOnly operations
   *
   * @param workNote - Work note to chunk and embed
   * @param personIds - Person IDs associated with the work note
   * @param deleteStaleChunks - Whether to delete stale chunks after upsert
   */
  private async performChunkingAndEmbedding(
    workNote: WorkNote,
    personIds: string[],
    deleteStaleChunks: boolean = false
  ): Promise<void> {
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

    // Upsert chunks into Vectorize using centralized EmbeddingProcessor
    await this.embeddingProcessor.upsertChunks(chunksToEmbed);

    // Delete stale chunks if requested (for updates)
    if (deleteStaleChunks) {
      const newChunkIds = new Set(chunksToEmbed.map((c) => c.id));
      await this.embeddingProcessor.deleteStaleChunks(workNote.workId, newChunkIds);
    }

    // Update embedded_at timestamp on success
    await this.repository.updateEmbeddedAt(workNote.workId);
  }

  /**
   * Delete all chunks for a work note from Vectorize
   */
  private async deleteWorkNoteChunks(workId: string): Promise<void> {
    try {
      const results = await this.vectorizeService.query(new Array(1536).fill(0), {
        topK: 500,
        filter: { work_id: workId },
        returnMetadata: false,
      });

      if (results.matches.length > 0) {
        const chunkIds = results.matches.map((match) => match.id);
        await this.vectorizeService.delete(chunkIds);
      }
    } catch (error) {
      console.error('Error deleting work note chunks:', error);
      // Non-fatal: log and continue
    }
  }

  /**
   * Re-embed work note without modifying any database fields
   * Used when todo changes or other non-content updates require vector store refresh
   *
   * This method:
   * - Reads current work note data from DB
   * - Re-chunks and re-embeds into vector store
   * - Updates only embedded_at timestamp
   * - Does NOT create version history or modify updated_at
   *
   * @param workId - Work note ID to re-embed
   */
  async reembedOnly(workId: string): Promise<void> {
    const workNote = await this.repository.findById(workId);

    if (!workNote) {
      throw new Error(`Work note ${workId} not found`);
    }

    // Get work note details for person_ids
    const details = await this.repository.findByIdWithDetails(workId);
    const personIds = details?.persons.map((p) => p.personId) || [];

    // Use shared chunking and embedding logic with stale chunk deletion
    await this.performChunkingAndEmbedding(workNote, personIds, true);
  }

  /**
   * Find similar work notes based on input text
   *
   * Searches for similar work notes using vector similarity and returns
   * basic information (title, content, category, todos) suitable for AI context.
   *
   * @param inputText - Text to find similar notes for
   * @param topK - Number of similar notes to return (default: 3)
   * @param scoreThreshold - Minimum similarity score (default: 0.7)
   * @returns Array of similar notes with title, content, category, and todos
   */
  async findSimilarNotes(
    inputText: string,
    topK: number = 3,
    scoreThreshold: number = 0.7
  ): Promise<SimilarWorkNoteReference[]> {
    try {
      // Search for similar work notes
      const queryEmbedding = await this.embeddingService.embed(inputText);
      const searchResults = await this.vectorizeService.query(queryEmbedding, {
        topK,
        returnMetadata: true,
      });
      const similarResults = searchResults.matches.map((match) => ({
        id: match.id,
        score: match.score,
        metadata: (match.metadata ?? {}) as Record<string, string>,
      }));

      // Filter by similarity threshold and extract work IDs
      const relevantResults = similarResults.filter((r) => r.score >= scoreThreshold);
      const workIdScores = new Map<string, number>();
      const workIds = [
        ...new Set(
          relevantResults
            .map((r) => {
              const workId = r.id?.split('#')[0];
              if (workId) {
                const currentScore = workIdScores.get(workId) || 0;
                workIdScores.set(workId, Math.max(currentScore, r.score));
              }
              return workId;
            })
            .filter((id): id is string => id !== undefined)
        ),
      ]; // Handle chunk IDs, deduplicate

      if (workIds.length === 0) {
        return [];
      }

      // Batch fetch work notes and todos in parallel (solves N+1 query problem)
      const [workNotes, todosByWorkId] = await Promise.all([
        this.repository.findByIds(workIds),
        this.repository.findTodosByWorkIds(workIds),
      ]);

      // Map results maintaining similarity order
      const workNoteMap = new Map(workNotes.map((note) => [note.workId, note]));

      return workIds
        .map((id) => workNoteMap.get(id))
        .filter((note): note is WorkNote => note !== undefined)
        .map((note) => ({
          workId: note.workId,
          title: note.title,
          content: note.contentRaw,
          category: note.category || undefined,
          similarityScore: workIdScores.get(note.workId) ?? 0,
          todos: todosByWorkId.get(note.workId) || [],
        }));
    } catch (error) {
      console.error('[WorkNoteService] Error finding similar notes:', error);
      return [];
    }
  }
}
