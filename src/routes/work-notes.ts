// Trace: SPEC-worknote-1, SPEC-rag-1, TASK-007, TASK-010, TASK-012
/**
 * Work note management routes with integrated RAG support
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../types/env';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../utils/validation';
import { createWorkNoteSchema, updateWorkNoteSchema, listWorkNotesQuerySchema } from '../schemas/work-note';
import { createTodoSchema } from '../schemas/todo';
import { WorkNoteService } from '../services/work-note-service';
import { TodoRepository } from '../repositories/todo-repository';
import { DomainError } from '../types/errors';

const workNotes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All work note routes require authentication
workNotes.use('*', authMiddleware);

/**
 * Trigger re-embedding of a work note (fire-and-forget)
 * Used when todo changes require vector store update
 */
function triggerReembed(env: Env, workId: string, todoId: string, operation: string): void {
  const service = new WorkNoteService(env);
  service.reembedOnly(workId).catch((error) => {
    console.error(`[WorkNote] Failed to re-embed after todo ${operation}:`, {
      workId,
      todoId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * GET /work-notes - List work notes with filters
 */
workNotes.get('/', async (c) => {
  try {
    const query = validateQuery(c, listWorkNotesQuerySchema);
    const service = new WorkNoteService(c.env);
    const results = await service.findAll(query);

    return c.json(results);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error listing work notes:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /work-notes - Create new work note
 * Automatically chunks and embeds for RAG
 */
workNotes.post('/', async (c) => {
  try {
    const data = await validateBody(c, createWorkNoteSchema);
    const service = new WorkNoteService(c.env);
    const workNote = await service.create(data);

    return c.json(workNote, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
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
    const service = new WorkNoteService(c.env);
    const workNote = await service.findByIdWithDetails(workId);

    if (!workNote) {
      return c.json({ code: 'NOT_FOUND', message: `Work note not found: ${workId}` }, 404);
    }

    return c.json(workNote);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error getting work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * PUT /work-notes/:workId - Update work note
 * Automatically re-chunks and re-embeds for RAG
 */
workNotes.put('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const data = await validateBody(c, updateWorkNoteSchema);
    const service = new WorkNoteService(c.env);
    const workNote = await service.update(workId, data);

    return c.json(workNote);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error updating work note:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * DELETE /work-notes/:workId - Delete work note
 * Automatically deletes all chunks from Vectorize
 */
workNotes.delete('/:workId', async (c) => {
  try {
    const { workId } = c.req.param();
    const service = new WorkNoteService(c.env);
    await service.delete(workId);

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
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
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error getting work note todos:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /work-notes/:workId/todos - Create todo for work note
 * Re-embeds the parent work note to include new todo in vector store
 */
workNotes.post('/:workId/todos', async (c) => {
  try {
    const { workId } = c.req.param();
    const data = await validateBody(c, createTodoSchema);
    const repository = new TodoRepository(c.env.DB);
    const todo = await repository.create(workId, data);

    // Re-embed work note to include new todo in vector store (async, non-blocking)
    triggerReembed(c.env, workId, todo.todoId, 'creation');

    return c.json(todo, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error creating todo:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default workNotes;
