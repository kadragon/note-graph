// Trace: SPEC-dept-1, TASK-006
/**
 * Department management routes
 */

import type { AuthUser } from '@shared/types/auth';
import { Hono } from 'hono';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { DepartmentRepository } from '../repositories/department-repository';
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from '../schemas/department';
import { validateBody, validateQuery } from '../utils/validation';

const departments = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All department routes require authentication
departments.use('*', authMiddleware);
departments.use('*', errorHandler);

/**
 * GET /departments - List all departments
 */
departments.get('/', async (c) => {
  const query = validateQuery(c, listDepartmentsQuerySchema);
  const repository = new DepartmentRepository(c.env.DB);
  const results = await repository.findAll(query.q, query.limit);

  return c.json(results);
});

/**
 * POST /departments - Create new department
 */
departments.post('/', async (c) => {
  const data = await validateBody(c, createDepartmentSchema);
  const repository = new DepartmentRepository(c.env.DB);
  const department = await repository.create(data);

  return c.json(department, 201);
});

/**
 * GET /departments/:deptName - Get department by name
 */
departments.get('/:deptName', async (c) => {
  const { deptName } = c.req.param();
  const repository = new DepartmentRepository(c.env.DB);
  const department = await repository.findByName(deptName);

  if (!department) {
    return c.json({ code: 'NOT_FOUND', message: `Department not found: ${deptName}` }, 404);
  }

  return c.json(department);
});

/**
 * PUT /departments/:deptName - Update department
 */
departments.put('/:deptName', async (c) => {
  const { deptName } = c.req.param();
  const data = await validateBody(c, updateDepartmentSchema);
  const repository = new DepartmentRepository(c.env.DB);
  const department = await repository.update(deptName, data);

  return c.json(department);
});

/**
 * GET /departments/:deptName/work-notes - Get department's work notes
 */
departments.get('/:deptName/work-notes', async (c) => {
  const { deptName } = c.req.param();
  const repository = new DepartmentRepository(c.env.DB);
  const workNotes = await repository.getWorkNotes(deptName);

  return c.json(workNotes);
});

export default departments;
