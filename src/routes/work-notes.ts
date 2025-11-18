// Trace: SPEC-worknote-1, TASK-007
/**
 * Work note management routes
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../utils/validation';
import { createWorkNoteSchema, updateWorkNoteSchema, listWorkNotesQuerySchema } from '../schemas/work-note';
import { createTodoSchema } from '../schemas/todo';
import { WorkNoteRepository } from '../repositories/work-note-repository';
import { DomainError } from '../types/errors';

const workNotes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All work note routes require authentication
workNotes.use('*', authMiddleware);

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
  const { workId } = c.req.param();

  // TODO: Implement TodoRepository.findByWorkId(workId) in TASK-008
  return c.json({
    message: 'Get work note todos endpoint (to be implemented in TASK-008)',
    workId,
  });
});

/**
 * POST /work-notes/:workId/todos - Create todo for work note
 */
workNotes.post('/:workId/todos', async (c) => {
  const { workId } = c.req.param();
  const data = await validateBody(c, createTodoSchema);

  // TODO: Implement TodoRepository.create(workId, data) in TASK-008
  return c.json(
    {
      message: 'Create todo for work note endpoint (to be implemented in TASK-008)',
      workId,
      data,
    },
    201
  );
});

export default workNotes;
