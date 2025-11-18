// Trace: SPEC-person-1, TASK-005
/**
 * Person management routes
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../utils/validation';
import { createPersonSchema, updatePersonSchema, listPersonsQuerySchema } from '../schemas/person';
import { PersonRepository } from '../repositories/person-repository';
import { DomainError } from '../types/errors';

const persons = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All person routes require authentication
persons.use('*', authMiddleware);

/**
 * GET /persons - List all persons with optional search
 */
persons.get('/', async (c) => {
  try {
    const query = validateQuery(c, listPersonsQuerySchema);
    const repository = new PersonRepository(c.env.DB);
    const results = await repository.findAll(query.q);

    return c.json(results);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode);
    }
    console.error('Error listing persons:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /persons - Create new person
 */
persons.post('/', async (c) => {
  try {
    const data = await validateBody(c, createPersonSchema);
    const repository = new PersonRepository(c.env.DB);
    const person = await repository.create(data);

    return c.json(person, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode);
    }
    console.error('Error creating person:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /persons/:personId - Get person by ID
 */
persons.get('/:personId', async (c) => {
  try {
    const { personId } = c.req.param();
    const repository = new PersonRepository(c.env.DB);
    const person = await repository.findById(personId);

    if (!person) {
      return c.json({ code: 'NOT_FOUND', message: `Person not found: ${personId}` }, 404);
    }

    return c.json(person);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode);
    }
    console.error('Error getting person:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * PUT /persons/:personId - Update person
 */
persons.put('/:personId', async (c) => {
  try {
    const { personId } = c.req.param();
    const data = await validateBody(c, updatePersonSchema);
    const repository = new PersonRepository(c.env.DB);
    const person = await repository.update(personId, data);

    return c.json(person);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode);
    }
    console.error('Error updating person:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /persons/:personId/history - Get person department history
 */
persons.get('/:personId/history', async (c) => {
  try {
    const { personId } = c.req.param();
    const repository = new PersonRepository(c.env.DB);
    const history = await repository.getDepartmentHistory(personId);

    return c.json(history);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode);
    }
    console.error('Error getting person history:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /persons/:personId/work-notes - Get person's work notes
 */
persons.get('/:personId/work-notes', async (c) => {
  try {
    const { personId } = c.req.param();
    const repository = new PersonRepository(c.env.DB);
    const workNotes = await repository.getWorkNotes(personId);

    return c.json(workNotes);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode);
    }
    console.error('Error getting person work notes:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default persons;
