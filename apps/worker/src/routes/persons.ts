// Trace: SPEC-person-1, SPEC-refactor-repository-di, TASK-005, TASK-LLM-IMPORT, TASK-060, TASK-REFACTOR-004
/**
 * Person management routes
 */

import type { Person } from '@shared/types/person';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import {
  createPersonSchema,
  importPersonFromTextSchema,
  listPersonsQuerySchema,
  updatePersonSchema,
} from '../schemas/person';
import { PersonImportService } from '../services/person-import-service';
import type { AppContext } from '../types/context';

const persons = new Hono<AppContext>();

// All person routes require authentication
persons.use('*', authMiddleware);
persons.use('*', errorHandler);

/**
 * GET /persons - List all persons with optional search
 */
persons.get('/', queryValidator(listPersonsQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listPersonsQuerySchema>(c);
  const { persons: repository } = c.get('repositories');
  const results = await repository.findAll(query.q);

  return c.json(results);
});

/**
 * POST /persons - Create new person
 * Department must already exist; otherwise returns validation error
 */
persons.post('/', bodyValidator(createPersonSchema), async (c) => {
  const data = getValidatedBody<typeof createPersonSchema>(c);
  const { persons: repository } = c.get('repositories');
  const person = await repository.create(data);

  return c.json(person, 201);
});

/**
 * GET /persons/:personId - Get person by ID
 */
persons.get('/:personId', async (c) => {
  const { personId } = c.req.param();
  const { persons: repository } = c.get('repositories');
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
persons.put('/:personId', bodyValidator(updatePersonSchema), async (c) => {
  const personId = c.req.param('personId');
  const data = getValidatedBody<typeof updatePersonSchema>(c);
  const { persons: repository } = c.get('repositories');
  const person = await repository.update(personId, data);

  return c.json(person);
});

/**
 * GET /persons/:personId/history - Get person department history
 */
persons.get('/:personId/history', async (c) => {
  const personId = c.req.param('personId');
  const { persons: repository } = c.get('repositories');
  const history = await repository.getDepartmentHistory(personId);

  return c.json(history);
});

/**
 * GET /persons/:personId/work-notes - Get person's work notes
 */
persons.get('/:personId/work-notes', async (c) => {
  const personId = c.req.param('personId');
  const { persons: repository } = c.get('repositories');
  const workNotes = await repository.getWorkNotes(personId);

  return c.json(workNotes);
});

/**
 * POST /persons/import-from-text - Parse person data from text using LLM
 */
persons.post('/import-from-text', bodyValidator(importPersonFromTextSchema), async (c) => {
  const data = getValidatedBody<typeof importPersonFromTextSchema>(c);
  const importService = new PersonImportService(c.env);
  const parsed = await importService.parsePersonFromText(data.text);

  return c.json(parsed);
});

/**
 * POST /persons/import - Import person from parsed data (create or update)
 * Department is auto-created atomically in the same transaction
 */
persons.post('/import', bodyValidator(createPersonSchema), async (c) => {
  const data = getValidatedBody<typeof createPersonSchema>(c);
  // Use autoCreateDepartment option to create department in the same transaction
  const { personsWithAutoCreateDepartment: personRepository } = c.get('repositories');

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
