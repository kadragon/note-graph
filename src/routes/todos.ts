// Trace: SPEC-todo-1, TASK-004
/**
 * Todo management routes
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../utils/validation';
import { updateTodoSchema, listTodosQuerySchema } from '../schemas/todo';

const todos = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All todo routes require authentication
todos.use('*', authMiddleware);

/**
 * GET /todos - List todos with view filters
 */
todos.get('/', async (c) => {
  const query = validateQuery(c, listTodosQuerySchema);

  // TODO: Implement TodoRepository.findAll(query) in TASK-008
  return c.json({
    message: 'List todos endpoint (to be implemented in TASK-008)',
    query,
  });
});

/**
 * PATCH /todos/:todoId - Update todo (including status changes)
 */
todos.patch('/:todoId', async (c) => {
  const { todoId } = c.req.param();
  const data = await validateBody(c, updateTodoSchema);

  // TODO: Implement TodoRepository.update(todoId, data) in TASK-008
  // Handle recurrence logic on status change to '완료'
  return c.json({
    message: 'Update todo endpoint (to be implemented in TASK-008)',
    todoId,
    data,
  });
});

export default todos;
