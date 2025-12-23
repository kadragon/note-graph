// Trace: SPEC-todo-1, TASK-008
/**
 * Todo management routes
 */

import type { AuthUser } from '@shared/types/auth';
import { Hono } from 'hono';
import type { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { TodoRepository } from '../repositories/todo-repository';
import { listTodosQuerySchema, updateTodoSchema } from '../schemas/todo';
import { WorkNoteService } from '../services/work-note-service';
import { validateBody, validateQuery } from '../utils/validation';

const todos = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// All todo routes require authentication
todos.use('*', authMiddleware);
todos.use('*', errorHandler);

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
  const query = validateQuery(c, listTodosQuerySchema);
  const repository = new TodoRepository(c.env.DB);
  const results = await repository.findAll(query);

  return c.json(results);
});

/**
 * PATCH /todos/:todoId - Update todo (including status changes)
 * Re-embeds the parent work note to reflect updated todo in vector store
 */
todos.patch('/:todoId', async (c) => {
  const { todoId } = c.req.param();
  const data = await validateBody(c, updateTodoSchema);
  const repository = new TodoRepository(c.env.DB);
  const todo = await repository.update(todoId, data);

  // Re-embed work note to reflect updated todo in vector store (async, non-blocking)
  triggerReembed(c.env, todo.workId, todo.todoId, 'update');

  return c.json(todo);
});

/**
 * DELETE /todos/:todoId - Delete todo
 * Re-embeds the parent work note to remove deleted todo from vector store
 */
todos.delete('/:todoId', async (c) => {
  const { todoId } = c.req.param();
  const repository = new TodoRepository(c.env.DB);

  // Delete returns workId to avoid redundant lookup
  const workId = await repository.delete(todoId);

  // Re-embed work note to remove deleted todo from vector store (async, non-blocking)
  triggerReembed(c.env, workId, todoId, 'deletion');

  return c.body(null, 204);
});

export default todos;
