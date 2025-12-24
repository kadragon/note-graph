// Trace: SPEC-dept-1, SPEC-refactor-repository-di, TASK-006, TASK-REFACTOR-004
/**
 * Department management routes
 */

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
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from '../schemas/department';
import type { AppContext } from '../types/context';

const departments = new Hono<AppContext>();

// All department routes require authentication
departments.use('*', authMiddleware);
departments.use('*', errorHandler);

/**
 * GET /departments - List all departments
 */
departments.get('/', queryValidator(listDepartmentsQuerySchema), async (c) => {
  const query = getValidatedQuery(c, listDepartmentsQuerySchema);
  const { departments: repository } = c.get('repositories');
  const results = await repository.findAll(query.q, query.limit);

  return c.json(results);
});

/**
 * POST /departments - Create new department
 */
departments.post('/', bodyValidator(createDepartmentSchema), async (c) => {
  const data = getValidatedBody(c, createDepartmentSchema);
  const { departments: repository } = c.get('repositories');
  const department = await repository.create(data);

  return c.json(department, 201);
});

/**
 * GET /departments/:deptName - Get department by name
 */
departments.get('/:deptName', async (c) => {
  const { deptName } = c.req.param();
  const { departments: repository } = c.get('repositories');
  const department = await repository.findByName(deptName);

  if (!department) {
    return c.json({ code: 'NOT_FOUND', message: `Department not found: ${deptName}` }, 404);
  }

  return c.json(department);
});

/**
 * PUT /departments/:deptName - Update department
 */
departments.put('/:deptName', bodyValidator(updateDepartmentSchema), async (c) => {
  const deptName = c.req.param('deptName');
  const data = getValidatedBody(c, updateDepartmentSchema);
  const { departments: repository } = c.get('repositories');
  const department = await repository.update(deptName, data);

  return c.json(department);
});

/**
 * GET /departments/:deptName/work-notes - Get department's work notes
 */
departments.get('/:deptName/work-notes', async (c) => {
  const deptName = c.req.param('deptName');
  const { departments: repository } = c.get('repositories');
  const workNotes = await repository.getWorkNotes(deptName);

  return c.json(workNotes);
});

export default departments;
