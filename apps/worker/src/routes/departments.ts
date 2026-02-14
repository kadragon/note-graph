// Trace: SPEC-dept-1, SPEC-refactor-repository-di, TASK-006, TASK-REFACTOR-004
/**
 * Department management routes
 */

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
import { notFoundJson } from './_shared/route-responses';
import { createProtectedRouter } from './_shared/router-factory';

const departments = createProtectedRouter();

/**
 * GET /departments - List all departments
 */
departments.get('/', queryValidator(listDepartmentsQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listDepartmentsQuerySchema>(c);
  const { departments: repository } = c.get('repositories');
  const results = await repository.findAll(query.q, query.limit);

  return c.json(results);
});

/**
 * POST /departments - Create new department
 */
departments.post('/', bodyValidator(createDepartmentSchema), async (c) => {
  const data = getValidatedBody<typeof createDepartmentSchema>(c);
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
    return notFoundJson(c, 'Department', deptName);
  }

  return c.json(department);
});

/**
 * PUT /departments/:deptName - Update department
 */
departments.put('/:deptName', bodyValidator(updateDepartmentSchema), async (c) => {
  const deptName = c.req.param('deptName');
  const data = getValidatedBody<typeof updateDepartmentSchema>(c);
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
