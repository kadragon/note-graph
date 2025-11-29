// Trace: SPEC-rag-1, SPEC-rag-2, SPEC-ai-draft-refs-1, TASK-012, TASK-022, TASK-029
/**
 * Work note service coordinating D1, chunking, and embedding operations
 * Uses embedded_at tracking for embedding state management
 */

import type { Env } from '../types/env';
import type { WorkNote, WorkNoteDetail } from '../types/work-note';
import type { CreateWorkNoteInput, UpdateWorkNoteInput, ListWorkNotesQuery } from '../schemas/work-note';
import type { SimilarWorkNoteReference } from '../types/search';
import { WorkNoteRepository } from '../repositories/work-note-repository';
import { ChunkingService } from './chunking-service';
import { EmbeddingService, VectorizeService } from './embedding-service';
import { format } from 'date-fns';

/**
 * Work note service with integrated RAG support
 *
 * Coordinates:
 * - D1 operations via WorkNoteRepository
 * - Text chunking via ChunkingService
 * - Vector embeddings via VectorizeService
 */
export class WorkNoteService {
  private repository: WorkNoteRepository;
  private chunkingService: ChunkingService;
  private vectorizeService: VectorizeService;

  constructor(env: Env) {
    this.repository = new WorkNoteRepository(env.DB);
    this.chunkingService = new ChunkingService();

    const embeddingService = new EmbeddingService(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE, embeddingService);
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
   */
  async create(data: CreateWorkNoteInput): Promise<WorkNote> {
    // Create work note in D1
    const workNote = await this.repository.create(data);

    // Chunk and embed for RAG (best-effort, non-blocking on failure)
    try {
      await this.chunkAndEmbedWorkNote(workNote, data);
    } catch (error) {
      console.error('[WorkNoteService] Failed to embed work note:', {
        workId: workNote.workId,
        title: workNote.title,
        error: error instanceof Error ? error.message : String(error),
      });
      // Note: embedded_at remains NULL and can be retried via /admin/embed-pending
    }

    return workNote;
  }

  /**
   * Update work note with automatic chunking and embedding
   * D1 write always succeeds; embedding failures are logged but don't fail the operation
   */
  async update(workId: string, data: UpdateWorkNoteInput): Promise<WorkNote> {
    // Update work note in D1
    const workNote = await this.repository.update(workId, data);

    // Re-chunk and re-embed for RAG (best-effort, non-blocking on failure)
    try {
      await this.rechunkAndEmbedWorkNote(workNote, data);
    } catch (error) {
      console.error('[WorkNoteService] Failed to re-embed work note:', {
        workId: workNote.workId,
        title: workNote.title,
        error: error instanceof Error ? error.message : String(error),
      });
      // Note: embedded_at remains NULL and can be retried via /admin/embed-pending
    }

    return workNote;
  }

  /**
   * Delete work note and remove embeddings
   */
  async delete(workId: string): Promise<void> {
    // Delete from D1
    await this.repository.delete(workId);

    // Delete chunks from Vectorize (async, non-blocking)
    this.vectorizeService.deleteWorkNoteChunks(workId).catch((error) => {
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
  private async chunkAndEmbedWorkNote(workNote: WorkNote, data: CreateWorkNoteInput): Promise<void> {
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
  private async rechunkAndEmbedWorkNote(workNote: WorkNote, data: UpdateWorkNoteInput): Promise<void> {
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

    // Upsert chunks into Vectorize
    await this.vectorizeService.upsertChunks(chunksToEmbed);

    // Delete stale chunks if requested (for updates)
    if (deleteStaleChunks) {
      const newChunkIds = new Set(chunksToEmbed.map((c) => c.id));
      await this.vectorizeService.deleteStaleChunks(workNote.workId, newChunkIds);
    }

    // Update embedded_at timestamp on success
    await this.repository.updateEmbeddedAt(workNote.workId);
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
      const similarResults = await this.vectorizeService.search(inputText, topK);

      // Filter by similarity threshold and extract work IDs
      const relevantResults = similarResults.filter((r) => r.score >= scoreThreshold);
      const workIdScores = new Map<string, number>();
      const workIds = [...new Set(
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
      )]; // Handle chunk IDs, deduplicate

      if (workIds.length === 0) {
        return [];
      }

      // Batch fetch work notes and todos in parallel (solves N+1 query problem)
      const [workNotes, todosByWorkId] = await Promise.all([
        this.repository.findByIds(workIds),
        this.repository.findTodosByWorkIds(workIds),
      ]);

      // Map results maintaining similarity order
      const workNoteMap = new Map(
        workNotes.map((note) => [note.workId, note])
      );

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
