// Trace: SPEC-person-1, TASK-005, TASK-LLM-IMPORT, TASK-060
/**
 * Person management routes
 */

import type { AuthUser } from '@shared/types/auth';
import type { Person } from '@shared/types/person';
import { Hono } from 'hono';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { PersonRepository } from '../repositories/person-repository';
import {
  createPersonSchema,
  importPersonFromTextSchema,
  listPersonsQuerySchema,
  updatePersonSchema,
} from '../schemas/person';
import { PersonImportService } from '../services/person-import-service';
import { validateBody, validateQuery } from '../utils/validation';

const persons = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All person routes require authentication
persons.use('*', authMiddleware);
persons.use('*', errorHandler);

/**
 * GET /persons - List all persons with optional search
 */
persons.get('/', async (c) => {
  const query = validateQuery(c, listPersonsQuerySchema);
  const repository = new PersonRepository(c.env.DB);
  const results = await repository.findAll(query.q);

  return c.json(results);
});

/**
 * POST /persons - Create new person
 * Department must already exist; otherwise returns validation error
 */
persons.post('/', async (c) => {
  const data = await validateBody(c, createPersonSchema);
  const personRepository = new PersonRepository(c.env.DB);
  const person = await personRepository.create(data);

  return c.json(person, 201);
});

/**
 * GET /persons/:personId - Get person by ID
 */
persons.get('/:personId', async (c) => {
  const { personId } = c.req.param();
  const repository = new PersonRepository(c.env.DB);
  const person = await repository.findById(personId);

  if (!person) {
    return c.json({ code: 'NOT_FOUND', message: `Person not found: ${personId}` }, 404);
  }

  return c.json(person);
});

/**
 * PUT /persons/:personId - Update person
 * Department must already exist; otherwise returns validation error
 */
persons.put('/:personId', async (c) => {
  const { personId } = c.req.param();
  const data = await validateBody(c, updatePersonSchema);
  const personRepository = new PersonRepository(c.env.DB);
  const person = await personRepository.update(personId, data);

  return c.json(person);
});

/**
 * GET /persons/:personId/history - Get person department history
 */
persons.get('/:personId/history', async (c) => {
  const { personId } = c.req.param();
  const repository = new PersonRepository(c.env.DB);
  const history = await repository.getDepartmentHistory(personId);

  return c.json(history);
});

/**
 * GET /persons/:personId/work-notes - Get person's work notes
 */
persons.get('/:personId/work-notes', async (c) => {
  const { personId } = c.req.param();
  const repository = new PersonRepository(c.env.DB);
  const workNotes = await repository.getWorkNotes(personId);

  return c.json(workNotes);
});

/**
 * POST /persons/import-from-text - Parse person data from text using LLM
 */
persons.post('/import-from-text', async (c) => {
  const data = await validateBody(c, importPersonFromTextSchema);
  const importService = new PersonImportService(c.env);
  const parsed = await importService.parsePersonFromText(data.text);

  return c.json(parsed);
});

/**
 * POST /persons/import - Import person from parsed data (create or update)
 * Department is auto-created atomically in the same transaction
 */
persons.post('/import', async (c) => {
  const data = await validateBody(c, createPersonSchema);
  // Use autoCreateDepartment option to create department in the same transaction
  const personRepository = new PersonRepository(c.env.DB, { autoCreateDepartment: true });

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
});

export default persons;
