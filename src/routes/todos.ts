// Trace: SPEC-todo-1, TASK-008
/**
 * Todo management routes
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../index';
import type { AuthUser } from '../types/auth';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../utils/validation';
import { updateTodoSchema, listTodosQuerySchema } from '../schemas/todo';
import { TodoRepository } from '../repositories/todo-repository';
import { DomainError } from '../types/errors';

const todos = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All todo routes require authentication
todos.use('*', authMiddleware);

/**
 * GET /todos - List todos with view filters
 */
todos.get('/', async (c) => {
  try {
    const query = validateQuery(c, listTodosQuerySchema);
    const repository = new TodoRepository(c.env.DB);
    const results = await repository.findAll(query);

    return c.json(results);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error listing todos:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * PATCH /todos/:todoId - Update todo (including status changes)
 */
todos.patch('/:todoId', async (c) => {
  try {
    const { todoId } = c.req.param();
    const data = await validateBody(c, updateTodoSchema);
    const repository = new TodoRepository(c.env.DB);
    const todo = await repository.update(todoId, data);

    return c.json(todo);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error updating todo:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

/**
 * DELETE /todos/:todoId - Delete todo
 */
todos.delete('/:todoId', async (c) => {
  try {
    const { todoId } = c.req.param();
    const repository = new TodoRepository(c.env.DB);
    await repository.delete(todoId);

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json({ code: error.code, message: error.message, details: error.details }, error.statusCode as ContentfulStatusCode);
    }
    console.error('Error deleting todo:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
  }
});

export default todos;
