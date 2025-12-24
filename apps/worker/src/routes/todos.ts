// Trace: SPEC-todo-1, SPEC-refactor-repository-di, TASK-008, TASK-REFACTOR-004
/**
 * Todo management routes
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
import { listTodosQuerySchema, updateTodoSchema } from '../schemas/todo';
import { WorkNoteService } from '../services/work-note-service';
import type { AppContext } from '../types/context';

const todos = new Hono<AppContext>();

// All todo routes require authentication
todos.use('*', authMiddleware);
todos.use('*', errorHandler);

/**
 * Trigger re-embedding of a work note (fire-and-forget)
 * Used when todo changes require vector store update
 */
function triggerReembed(
  env: AppContext['Bindings'],
  workId: string,
  todoId: string,
  operation: string
): void {
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
todos.get('/', queryValidator(listTodosQuerySchema), async (c) => {
  const query = getValidatedQuery(c, listTodosQuerySchema);
  const { todos: repository } = c.get('repositories');
  const results = await repository.findAll(query);

  return c.json(results);
});

/**
 * PATCH /todos/:todoId - Update todo (including status changes)
 * Re-embeds the parent work note to reflect updated todo in vector store
 */
todos.patch('/:todoId', bodyValidator(updateTodoSchema), async (c) => {
  const todoId = c.req.param('todoId');
  const data = getValidatedBody(c, updateTodoSchema);
  const { todos: repository } = c.get('repositories');
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
  const todoId = c.req.param('todoId');
  const { todos: repository } = c.get('repositories');

  // Delete returns workId to avoid redundant lookup
  const workId = await repository.delete(todoId);

  // Re-embed work note to remove deleted todo from vector store (async, non-blocking)
  triggerReembed(c.env, workId, todoId, 'deletion');

  return c.body(null, 204);
});

export default todos;
