// Trace: SPEC-worknote-1, TASK-004
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

const workNotes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All work note routes require authentication
workNotes.use('*', authMiddleware);

/**
 * GET /work-notes - List work notes with filters
 */
workNotes.get('/', async (c) => {
  const query = validateQuery(c, listWorkNotesQuerySchema);

  // TODO: Implement WorkNoteRepository.findAll(query) in TASK-007
  return c.json({
    message: 'List work notes endpoint (to be implemented in TASK-007)',
    query,
  });
});

/**
 * POST /work-notes - Create new work note
 */
workNotes.post('/', async (c) => {
  const data = await validateBody(c, createWorkNoteSchema);

  // TODO: Implement WorkNoteRepository.create(data) in TASK-007
  return c.json(
    {
      message: 'Create work note endpoint (to be implemented in TASK-007)',
      data,
    },
    201
  );
});

/**
 * GET /work-notes/:workId - Get work note by ID
 */
workNotes.get('/:workId', async (c) => {
  const { workId } = c.req.param();

  // TODO: Implement WorkNoteRepository.findById(workId) in TASK-007
  return c.json({
    message: 'Get work note endpoint (to be implemented in TASK-007)',
    workId,
  });
});

/**
 * PUT /work-notes/:workId - Update work note
 */
workNotes.put('/:workId', async (c) => {
  const { workId } = c.req.param();
  const data = await validateBody(c, updateWorkNoteSchema);

  // TODO: Implement WorkNoteRepository.update(workId, data) in TASK-007
  return c.json({
    message: 'Update work note endpoint (to be implemented in TASK-007)',
    workId,
    data,
  });
});

/**
 * DELETE /work-notes/:workId - Delete work note
 */
workNotes.delete('/:workId', async (c) => {
  const { workId } = c.req.param();

  // TODO: Implement WorkNoteRepository.delete(workId) in TASK-007
  // For now, return 200 with message (will change to 204 with no content in actual implementation)
  return c.json({
    message: 'Delete work note endpoint (to be implemented in TASK-007)',
    workId,
  });
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
