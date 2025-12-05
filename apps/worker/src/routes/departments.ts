// Trace: SPEC-dept-1, TASK-006
/**
 * Department management routes
 */

import type { AuthUser } from '@shared/types/auth';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { DepartmentRepository } from '../repositories/department-repository';
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from '../schemas/department';
import { DomainError } from '../types/errors';
import { validateBody, validateQuery } from '../utils/validation';

const departments = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All department routes require authentication
departments.use('*', authMiddleware);

/**
 * GET /departments - List all departments
 */
departments.get('/', async (c) => {
  try {
    const query = validateQuery(c, listDepartmentsQuerySchema);
    const repository = new DepartmentRepository(c.env.DB);
    const results = await repository.findAll(query.q, query.limit);

    return c.json(results);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error listing departments:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /departments - Create new department
 */
departments.post('/', async (c) => {
  try {
    const data = await validateBody(c, createDepartmentSchema);
    const repository = new DepartmentRepository(c.env.DB);
    const department = await repository.create(data);

    return c.json(department, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error creating department:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /departments/:deptName - Get department by name
 */
departments.get('/:deptName', async (c) => {
  try {
    const { deptName } = c.req.param();
    const repository = new DepartmentRepository(c.env.DB);
    const department = await repository.findByName(deptName);

    if (!department) {
      return c.json({ code: 'NOT_FOUND', message: `Department not found: ${deptName}` }, 404);
    }

    return c.json(department);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting department:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * PUT /departments/:deptName - Update department
 */
departments.put('/:deptName', async (c) => {
  try {
    const { deptName } = c.req.param();
    const data = await validateBody(c, updateDepartmentSchema);
    const repository = new DepartmentRepository(c.env.DB);
    const department = await repository.update(deptName, data);

    return c.json(department);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error updating department:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /departments/:deptName/work-notes - Get department's work notes
 */
departments.get('/:deptName/work-notes', async (c) => {
  try {
    const { deptName } = c.req.param();
    const repository = new DepartmentRepository(c.env.DB);
    const workNotes = await repository.getWorkNotes(deptName);

    return c.json(workNotes);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting department work notes:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default departments;
