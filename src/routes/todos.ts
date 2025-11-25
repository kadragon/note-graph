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
import { WorkNoteService } from '../services/work-note-service';
import { DomainError } from '../types/errors';

const todos = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All todo routes require authentication
todos.use('*', authMiddleware);

/**
 * Trigger re-embedding of a work note (fire-and-forget)
 * Used when todo changes require vector store update
 */
function triggerReembed(env: Env, workId: string, todoId: string, operation: string): void {
  const service = new WorkNoteService(env);
  service.reembedOnly(workId).catch((error) => {
    console.error(`[WorkNote] Failed to re-embed after todo ${operation}:`, {
      workId,
      todoId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

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
 * Re-embeds the parent work note to reflect updated todo in vector store
 */
todos.patch('/:todoId', async (c) => {
  try {
    const { todoId } = c.req.param();
    const data = await validateBody(c, updateTodoSchema);
    const repository = new TodoRepository(c.env.DB);
    const todo = await repository.update(todoId, data);

    // Re-embed work note to reflect updated todo in vector store (async, non-blocking)
    triggerReembed(c.env, todo.workId, todo.todoId, 'update');

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
 * Re-embeds the parent work note to remove deleted todo from vector store
 */
todos.delete('/:todoId', async (c) => {
  try {
    const { todoId } = c.req.param();
    const repository = new TodoRepository(c.env.DB);

    // Delete returns workId to avoid redundant lookup
    const workId = await repository.delete(todoId);

    // Re-embed work note to remove deleted todo from vector store (async, non-blocking)
    triggerReembed(c.env, workId, todoId, 'deletion');

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
