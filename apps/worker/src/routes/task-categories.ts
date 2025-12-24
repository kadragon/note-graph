// Trace: SPEC-taskcategory-1, SPEC-refactor-repository-di, TASK-003, TASK-REFACTOR-004
/**
 * Task Category management routes
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
  createTaskCategorySchema,
  listTaskCategoriesQuerySchema,
  updateTaskCategorySchema,
} from '../schemas/task-category';
import type { AppContext } from '../types/context';

const taskCategories = new Hono<AppContext>();

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
taskCategories.get('/', queryValidator(listTaskCategoriesQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listTaskCategoriesQuerySchema>(c);
  const { taskCategories: repository } = c.get('repositories');
  const results = await repository.findAll(query.q, query.limit, query.activeOnly);

  return c.json(results);
});

/**
 * POST /task-categories - Create new task category
 */
taskCategories.post('/', bodyValidator(createTaskCategorySchema), async (c) => {
  const data = getValidatedBody<typeof createTaskCategorySchema>(c);
  const { taskCategories: repository } = c.get('repositories');
  const category = await repository.create(data);

  return c.json(category, 201);
});

/**
 * GET /task-categories/:categoryId - Get task category by ID
 */
taskCategories.get('/:categoryId', async (c) => {
  const { categoryId } = c.req.param();
  const { taskCategories: repository } = c.get('repositories');
  const category = await repository.findById(categoryId);

  if (!category) {
    return c.json({ code: 'NOT_FOUND', message: `Task category not found: ${categoryId}` }, 404);
  }

  return c.json(category);
});

/**
 * PUT /task-categories/:categoryId - Update task category
 */
taskCategories.put('/:categoryId', bodyValidator(updateTaskCategorySchema), async (c) => {
  const categoryId = c.req.param('categoryId');
  const data = getValidatedBody<typeof updateTaskCategorySchema>(c);
  const { taskCategories: repository } = c.get('repositories');
  const category = await repository.update(categoryId, data);

  return c.json(category);
});

/**
 * DELETE /task-categories/:categoryId - Delete task category
 */
taskCategories.delete('/:categoryId', async (c) => {
  const categoryId = c.req.param('categoryId');
  const { taskCategories: repository } = c.get('repositories');
  await repository.delete(categoryId);

  return c.json({ message: 'Task category deleted successfully' });
});

/**
 * GET /task-categories/:categoryId/work-notes - Get task category's work notes
 */
taskCategories.get('/:categoryId/work-notes', async (c) => {
  const { categoryId } = c.req.param();
  const { taskCategories: repository } = c.get('repositories');
  const workNotes = await repository.getWorkNotes(categoryId);

  return c.json(workNotes);
});

export default taskCategories;
