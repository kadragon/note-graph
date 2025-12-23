// Trace: SPEC-taskcategory-1, TASK-003
/**
 * Task Category management routes
 */

import type { AuthUser } from '@shared/types/auth';
import { Hono } from 'hono';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { TaskCategoryRepository } from '../repositories/task-category-repository';
import {
  createTaskCategorySchema,
  listTaskCategoriesQuerySchema,
  updateTaskCategorySchema,
} from '../schemas/task-category';
import { validateBody, validateQuery } from '../utils/validation';

const taskCategories = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All task category routes require authentication
taskCategories.use('*', authMiddleware);
taskCategories.use('*', errorHandler);

/**
 * GET /task-categories - List all task categories
 * Query params:
 *   - q: search query
 *   - limit: max results
 *   - activeOnly: if 'true', only return active categories
 */
taskCategories.get('/', async (c) => {
  const query = validateQuery(c, listTaskCategoriesQuerySchema);
  const repository = new TaskCategoryRepository(c.env.DB);
  const results = await repository.findAll(query.q, query.limit, query.activeOnly);

  return c.json(results);
});

/**
 * POST /task-categories - Create new task category
 */
taskCategories.post('/', async (c) => {
  const data = await validateBody(c, createTaskCategorySchema);
  const repository = new TaskCategoryRepository(c.env.DB);
  const category = await repository.create(data);

  return c.json(category, 201);
});

/**
 * GET /task-categories/:categoryId - Get task category by ID
 */
taskCategories.get('/:categoryId', async (c) => {
  const { categoryId } = c.req.param();
  const repository = new TaskCategoryRepository(c.env.DB);
  const category = await repository.findById(categoryId);

  if (!category) {
    return c.json({ code: 'NOT_FOUND', message: `Task category not found: ${categoryId}` }, 404);
  }

  return c.json(category);
});

/**
 * PUT /task-categories/:categoryId - Update task category
 */
taskCategories.put('/:categoryId', async (c) => {
  const { categoryId } = c.req.param();
  const data = await validateBody(c, updateTaskCategorySchema);
  const repository = new TaskCategoryRepository(c.env.DB);
  const category = await repository.update(categoryId, data);

  return c.json(category);
});

/**
 * DELETE /task-categories/:categoryId - Delete task category
 */
taskCategories.delete('/:categoryId', async (c) => {
  const { categoryId } = c.req.param();
  const repository = new TaskCategoryRepository(c.env.DB);
  await repository.delete(categoryId);

  return c.json({ message: 'Task category deleted successfully' });
});

/**
 * GET /task-categories/:categoryId/work-notes - Get task category's work notes
 */
taskCategories.get('/:categoryId/work-notes', async (c) => {
  const { categoryId } = c.req.param();
  const repository = new TaskCategoryRepository(c.env.DB);
  const workNotes = await repository.getWorkNotes(categoryId);

  return c.json(workNotes);
});

export default taskCategories;
