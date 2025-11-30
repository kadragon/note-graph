// Trace: SPEC-taskcategory-1, TASK-003
/**
 * Task Category management routes
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { TaskCategoryRepository } from '../repositories/task-category-repository';
import {
  createTaskCategorySchema,
  listTaskCategoriesQuerySchema,
  updateTaskCategorySchema,
} from '../schemas/task-category';
import type { AuthUser } from '../types/auth';
import { DomainError } from '../types/errors';
import { validateBody, validateQuery } from '../utils/validation';

const taskCategories = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All task category routes require authentication
taskCategories.use('*', authMiddleware);

/**
 * GET /task-categories - List all task categories
 * Query params:
 *   - q: search query
 *   - limit: max results
 *   - activeOnly: if 'true', only return active categories
 */
taskCategories.get('/', async (c) => {
  try {
    const query = validateQuery(c, listTaskCategoriesQuerySchema);
    const repository = new TaskCategoryRepository(c.env.DB);
    const results = await repository.findAll(query.q, query.limit, query.activeOnly);

    return c.json(results);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error listing task categories:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /task-categories - Create new task category
 */
taskCategories.post('/', async (c) => {
  try {
    const data = await validateBody(c, createTaskCategorySchema);
    const repository = new TaskCategoryRepository(c.env.DB);
    const category = await repository.create(data);

    return c.json(category, 201);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error creating task category:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /task-categories/:categoryId - Get task category by ID
 */
taskCategories.get('/:categoryId', async (c) => {
  try {
    const { categoryId } = c.req.param();
    const repository = new TaskCategoryRepository(c.env.DB);
    const category = await repository.findById(categoryId);

    if (!category) {
      return c.json({ code: 'NOT_FOUND', message: `Task category not found: ${categoryId}` }, 404);
    }

    return c.json(category);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting task category:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * PUT /task-categories/:categoryId - Update task category
 */
taskCategories.put('/:categoryId', async (c) => {
  try {
    const { categoryId } = c.req.param();
    const data = await validateBody(c, updateTaskCategorySchema);
    const repository = new TaskCategoryRepository(c.env.DB);
    const category = await repository.update(categoryId, data);

    return c.json(category);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error updating task category:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * DELETE /task-categories/:categoryId - Delete task category
 */
taskCategories.delete('/:categoryId', async (c) => {
  try {
    const { categoryId } = c.req.param();
    const repository = new TaskCategoryRepository(c.env.DB);
    await repository.delete(categoryId);

    return c.json({ message: 'Task category deleted successfully' });
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error deleting task category:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /task-categories/:categoryId/work-notes - Get task category's work notes
 */
taskCategories.get('/:categoryId/work-notes', async (c) => {
  try {
    const { categoryId } = c.req.param();
    const repository = new TaskCategoryRepository(c.env.DB);
    const workNotes = await repository.getWorkNotes(categoryId);

    return c.json(workNotes);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { code: error.code, message: error.message, details: error.details },
        error.statusCode as ContentfulStatusCode
      );
    }
    console.error('Error getting task category work notes:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default taskCategories;
