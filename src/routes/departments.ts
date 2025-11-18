// Trace: SPEC-dept-1, TASK-004
/**
 * Department management routes
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../utils/validation';
import { createDepartmentSchema, updateDepartmentSchema } from '../schemas/department';

const departments = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All department routes require authentication
departments.use('*', authMiddleware);

/**
 * GET /departments - List all departments
 */
departments.get('/', async (c) => {
  // TODO: Implement DepartmentRepository.findAll() in TASK-006
  return c.json({
    message: 'List departments endpoint (to be implemented in TASK-006)',
  });
});

/**
 * POST /departments - Create new department
 */
departments.post('/', async (c) => {
  const data = await validateBody(c, createDepartmentSchema);

  // TODO: Implement DepartmentRepository.create(data) in TASK-006
  return c.json(
    {
      message: 'Create department endpoint (to be implemented in TASK-006)',
      data,
    },
    201
  );
});

/**
 * GET /departments/:deptName - Get department by name
 */
departments.get('/:deptName', async (c) => {
  const { deptName } = c.req.param();

  // TODO: Implement DepartmentRepository.findByName(deptName) in TASK-006
  return c.json({
    message: 'Get department endpoint (to be implemented in TASK-006)',
    deptName,
  });
});

/**
 * PUT /departments/:deptName - Update department
 */
departments.put('/:deptName', async (c) => {
  const { deptName } = c.req.param();
  const data = await validateBody(c, updateDepartmentSchema);

  // TODO: Implement DepartmentRepository.update(deptName, data) in TASK-006
  return c.json({
    message: 'Update department endpoint (to be implemented in TASK-006)',
    deptName,
    data,
  });
});

/**
 * GET /departments/:deptName/work-notes - Get department's work notes
 */
departments.get('/:deptName/work-notes', async (c) => {
  const { deptName } = c.req.param();

  // TODO: Implement DepartmentRepository.getWorkNotes(deptName) in TASK-006
  return c.json({
    message: 'Get department work notes endpoint (to be implemented in TASK-006)',
    deptName,
  });
});

export default departments;
