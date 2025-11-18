// Trace: SPEC-rag-1, TASK-012
/**
 * Work note service coordinating D1, chunking, and embedding operations
 */

import type { Env } from '../types/env';
import type { WorkNote, WorkNoteDetail } from '../types/work-note';
import type { CreateWorkNoteInput, UpdateWorkNoteInput, ListWorkNotesQuery } from '../schemas/work-note';
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
  async findAll(query: ListWorkNotesQuery): Promise<WorkNote[]> {
    return this.repository.findAll(query);
  }

  /**
   * Create work note with automatic chunking and embedding
   */
  async create(data: CreateWorkNoteInput): Promise<WorkNote> {
    // Create work note in D1
    const workNote = await this.repository.create(data);

    // Chunk and embed for RAG (async, non-blocking)
    this.chunkAndEmbedWorkNote(workNote, data).catch((error) => {
      console.error('Error chunking and embedding work note:', error);
      // Non-fatal: work note is created, but RAG won't work for it
    });

    return workNote;
  }

  /**
   * Update work note with automatic chunking and embedding
   */
  async update(workId: string, data: UpdateWorkNoteInput): Promise<WorkNote> {
    // Update work note in D1
    const workNote = await this.repository.update(workId, data);

    // Re-chunk and re-embed for RAG (async, non-blocking)
    this.rechunkAndEmbedWorkNote(workNote, data).catch((error) => {
      console.error('Error re-chunking and embedding work note:', error);
      // Non-fatal: work note is updated, but RAG won't reflect changes
    });

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
      console.error('Error deleting work note chunks:', error);
      // Non-fatal: work note is deleted, but orphaned embeddings may remain
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
   */
  private async rechunkAndEmbedWorkNote(workNote: WorkNote, data: UpdateWorkNoteInput): Promise<void> {
    // Delete old chunks
    await this.vectorizeService.deleteWorkNoteChunks(workNote.workId);

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

    // Upsert new chunks into Vectorize
    await this.vectorizeService.upsertChunks(chunksToEmbed);
  }

  /**
   * Get department name from person IDs
   *
   * Uses the first person's current department
   */
  private async getDeptNameFromPersons(personIds: string[]): Promise<string | null> {
    if (personIds.length === 0) {
      return null;
    }

    // Get first person's department
    const result = await this.repository['db']
      .prepare('SELECT current_dept FROM persons WHERE person_id = ?')
      .bind(personIds[0])
      .first<{ current_dept: string | null }>();

    return result?.current_dept || null;
  }
}
