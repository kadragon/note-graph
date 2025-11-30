// Trace: SPEC-person-1, TASK-005, TASK-LLM-IMPORT
/**
 * Person management routes
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { DepartmentRepository } from '../repositories/department-repository';
import { PersonRepository } from '../repositories/person-repository';
import {
  createPersonSchema,
  importPersonFromTextSchema,
  listPersonsQuerySchema,
  updatePersonSchema,
} from '../schemas/person';
import { PersonImportService } from '../services/person-import-service';
import type { AuthUser } from '../types/auth';
import { DomainError } from '../types/errors';
import type { Person } from '../types/person';
import { validateBody, validateQuery } from '../utils/validation';

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
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
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
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
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
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
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
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
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
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
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
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting person work notes:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /persons/import-from-text - Parse person data from text using LLM
 */
persons.post('/import-from-text', async (c) => {
  try {
    const data = await validateBody(c, importPersonFromTextSchema);
    const importService = new PersonImportService(c.env);
    const parsed = await importService.parsePersonFromText(data.text);

    return c.json(parsed);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error parsing person from text:', error);
    return c.json(
      {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '서버 오류가 발생했습니다',
      },
      500
    );
  }
});

/**
 * POST /persons/import - Import person from parsed data (create or update)
 */
persons.post('/import', async (c) => {
  try {
    const data = await validateBody(c, createPersonSchema);
    const personRepository = new PersonRepository(c.env.DB);
    const deptRepository = new DepartmentRepository(c.env.DB);

    // Check if department exists, create if not
    if (data.currentDept) {
      const existingDept = await deptRepository.findByName(data.currentDept);
      if (!existingDept) {
        await deptRepository.create({
          deptName: data.currentDept,
          description: undefined,
        });
      }
    }

    // Check if person already exists
    const existingPerson = await personRepository.findById(data.personId);

    let person: Person;
    let isNew = false;

    if (existingPerson) {
      // Update existing person
      person = await personRepository.update(data.personId, {
        name: data.name,
        phoneExt: data.phoneExt,
        currentDept: data.currentDept,
        currentPosition: data.currentPosition,
        currentRoleDesc: data.currentRoleDesc,
        employmentStatus: data.employmentStatus,
      });
    } else {
      // Create new person
      person = await personRepository.create(data);
      isNew = true;
    }

    return c.json({ person, isNew }, isNew ? 201 : 200);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error importing person:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default persons;
