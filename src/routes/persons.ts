// Trace: SPEC-person-1, TASK-004
/**
 * Person management routes
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../utils/validation';
import { createPersonSchema, updatePersonSchema, listPersonsQuerySchema } from '../schemas/person';

const persons = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All person routes require authentication
persons.use('*', authMiddleware);

/**
 * GET /persons - List all persons with optional search
 */
persons.get('/', async (c) => {
  const query = validateQuery(c, listPersonsQuerySchema);

  // TODO: Implement PersonRepository.findAll(query) in TASK-005
  return c.json({
    message: 'List persons endpoint (to be implemented in TASK-005)',
    query,
  });
});

/**
 * POST /persons - Create new person
 */
persons.post('/', async (c) => {
  const data = await validateBody(c, createPersonSchema);

  // TODO: Implement PersonRepository.create(data) in TASK-005
  return c.json(
    {
      message: 'Create person endpoint (to be implemented in TASK-005)',
      data,
    },
    201
  );
});

/**
 * GET /persons/:personId - Get person by ID
 */
persons.get('/:personId', async (c) => {
  const { personId } = c.req.param();

  // TODO: Implement PersonRepository.findById(personId) in TASK-005
  return c.json({
    message: 'Get person endpoint (to be implemented in TASK-005)',
    personId,
  });
});

/**
 * PUT /persons/:personId - Update person
 */
persons.put('/:personId', async (c) => {
  const { personId } = c.req.param();
  const data = await validateBody(c, updatePersonSchema);

  // TODO: Implement PersonRepository.update(personId, data) in TASK-005
  return c.json({
    message: 'Update person endpoint (to be implemented in TASK-005)',
    personId,
    data,
  });
});

/**
 * GET /persons/:personId/history - Get person department history
 */
persons.get('/:personId/history', async (c) => {
  const { personId } = c.req.param();

  // TODO: Implement PersonRepository.getDepartmentHistory(personId) in TASK-005
  return c.json({
    message: 'Get person history endpoint (to be implemented in TASK-005)',
    personId,
  });
});

/**
 * GET /persons/:personId/work-notes - Get person's work notes
 */
persons.get('/:personId/work-notes', async (c) => {
  const { personId } = c.req.param();

  // TODO: Implement PersonRepository.getWorkNotes(personId) in TASK-005
  return c.json({
    message: 'Get person work notes endpoint (to be implemented in TASK-005)',
    personId,
  });
});

export default persons;
