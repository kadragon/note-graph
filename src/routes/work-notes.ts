// Trace: SPEC-worknote-1, TASK-007, TASK-010
/**
 * Work note management routes
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../utils/validation';
import { createWorkNoteSchema, updateWorkNoteSchema, listWorkNotesQuerySchema } from '../schemas/work-note';
import { createTodoSchema } from '../schemas/todo';
import { WorkNoteRepository } from '../repositories/work-note-repository';
import { TodoRepository } from '../repositories/todo-repository';
import { EmbeddingService, VectorizeService } from '../services/embedding-service';
import { DomainError } from '../types/errors';
import type { WorkNote } from '../types/work-note';

const workNotes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All work note routes require authentication
workNotes.use('*', authMiddleware);

/**
 * Helper function to update work note embedding
 * Shared between create and update handlers to avoid code duplication
 */
async function updateWorkNoteEmbedding(
  env: Env,
  workNote: WorkNote,
  personIds: string[]
): Promise<void> {
  try {
    const embeddingService = new EmbeddingService(env);
    const vectorizeService = new VectorizeService(env.VECTORIZE, embeddingService);

    const createdAtBucket = workNote.createdAt.substring(0, 10); // YYYY-MM-DD

    await vectorizeService.upsertWorkNote(workNote.workId, workNote.title, workNote.contentRaw, {
      person_ids: personIds.length > 0 ? VectorizeService.encodePersonIds(personIds) : undefined,
      category: workNote.category ?? undefined,
      created_at_bucket: createdAtBucket,
    });
  } catch (embeddingError) {
    // Log embedding error but don't fail the request
    // Work note operation is successful, embedding can be retried later
    console.error('Error updating embedding:', embeddingError);
  }
}

/**
 * GET /work-notes - List work notes with filters
 */
workNotes.get('/', async (c) => {
  try {
    const query = validateQuery(c, listWorkNotesQuerySchema);
    const repository = new WorkNoteRepository(c.env.DB);
    const results = await repository.findAll(query);

    return c.json(results);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as any);
    }
    console.error('Error listing work notes:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /work-notes - Create new work note
 */
workNotes.post('/', async (c) => {
  try {
    const data = await validateBody(c, createWorkNoteSchema);
    const repository = new WorkNoteRepository(c.env.DB);
    const workNote = await repository.create(data);

    // Generate and store embedding for vector search
    // Use personIds from request data to avoid extra DB call
    const personIds = data.persons?.map((p) => p.personId) ?? [];
    await updateWorkNoteEmbedding(c.env, workNote, personIds);

    return c.json(workNote, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as any);
    }
    console.error('Error creating work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /work-notes/:workId - Get work note by ID
 */
workNotes.get('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const repository = new WorkNoteRepository(c.env.DB);
    const workNote = await repository.findByIdWithDetails(workId);

    if (!workNote) {
      return c.json({ code: 'NOT_FOUND', message: `Work note not found: ${workId}` }, 404);
    }

    return c.json(workNote);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as any);
    }
    console.error('Error getting work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * PUT /work-notes/:workId - Update work note
 */
workNotes.put('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const data = await validateBody(c, updateWorkNoteSchema);
    const repository = new WorkNoteRepository(c.env.DB);
    const workNote = await repository.update(workId, data);

    // Update embedding if title, content, or persons changed
    if (data.title !== undefined || data.contentRaw !== undefined || data.persons !== undefined) {
      // Get person IDs - use updated persons if provided, otherwise fetch from DB
      let personIds: string[] = [];
      if (data.persons !== undefined) {
        personIds = data.persons.map((p) => p.personId);
      } else {
        // Only fetch if persons not in update data
        const workNoteDetails = await repository.findByIdWithDetails(workId);
        if (workNoteDetails) {
          personIds = workNoteDetails.persons.map((p) => p.personId);
        }
      }

      await updateWorkNoteEmbedding(c.env, workNote, personIds);
    }

    return c.json(workNote);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as any);
    }
    console.error('Error updating work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * DELETE /work-notes/:workId - Delete work note
 */
workNotes.delete('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const repository = new WorkNoteRepository(c.env.DB);
    await repository.delete(workId);

    // Delete embedding from Vectorize
    try {
      const embeddingService = new EmbeddingService(c.env);
      const vectorizeService = new VectorizeService(c.env.VECTORIZE, embeddingService);
      await vectorizeService.deleteWorkNote(workId);
    } catch (embeddingError) {
      // Log embedding error but don't fail the request
      console.error('Error deleting embedding:', embeddingError);
    }

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as any);
    }
    console.error('Error deleting work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /work-notes/:workId/todos - Get todos for work note
 */
workNotes.get('/:workId/todos', async (c) => {
  try {
    const { workId } = c.req.param();
    const repository = new TodoRepository(c.env.DB);
    const todos = await repository.findByWorkId(workId);

    return c.json(todos);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as any);
    }
    console.error('Error getting work note todos:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /work-notes/:workId/todos - Create todo for work note
 */
workNotes.post('/:workId/todos', async (c) => {
  try {
    const { workId } = c.req.param();
    const data = await validateBody(c, createTodoSchema);
    const repository = new TodoRepository(c.env.DB);
    const todo = await repository.create(workId, data);

    return c.json(todo, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as any);
    }
    console.error('Error creating todo:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default workNotes;
