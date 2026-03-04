// Trace: SPEC-todo-1, SPEC-refactor-repository-di, TASK-008, TASK-REFACTOR-004
/**
 * Todo management routes
 */

import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import { batchPostponeTodosSchema, listTodosQuerySchema, updateTodoSchema } from '../schemas/todo';
import { createProtectedRouter } from './_shared/router-factory';
import { triggerReembed } from './_shared/trigger-reembed';

const todos = createProtectedRouter();

/**
 * GET /todos - List todos with view filters
 */
todos.get('/', queryValidator(listTodosQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listTodosQuerySchema>(c);
  const { todos: repository } = c.get('repositories');
  const results = await repository.findAll(query);

  return c.json(results);
});

/**
 * PATCH /todos/batch-postpone - Batch postpone due dates for multiple todos
 * Must be registered before /:todoId to avoid parameter collision
 */
todos.patch('/batch-postpone', bodyValidator(batchPostponeTodosSchema), async (c) => {
  const data = getValidatedBody<typeof batchPostponeTodosSchema>(c);
  const { todos: repository } = c.get('repositories');
  const result = await repository.batchPostponeDueDates(data);

  if (result.updatedCount > 0) {
    c.executionCtx.waitUntil(
      triggerReembed(
        c.env,
        result.workId,
        result.updatedTodoIds[0]!,
        'batch-postpone',
        c.get('settingService')
      )
    );
  }

  return c.json({ updatedCount: result.updatedCount, skippedCount: result.skippedCount });
});

/**
 * PATCH /todos/:todoId - Update todo (including status changes)
 * Re-embeds the parent work note to reflect updated todo in vector store
 */
todos.patch('/:todoId', bodyValidator(updateTodoSchema), async (c) => {
  const todoId = c.req.param('todoId');
  const data = getValidatedBody<typeof updateTodoSchema>(c);
  const { todos: repository } = c.get('repositories');
  const todo = await repository.update(todoId, data);

  // Re-embed work note to reflect updated todo in vector store (async, non-blocking)
  c.executionCtx.waitUntil(
    triggerReembed(c.env, todo.workId, todo.todoId, 'update', c.get('settingService'))
  );

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
  c.executionCtx.waitUntil(
    triggerReembed(c.env, workId, todoId, 'deletion', c.get('settingService'))
  );

  return c.body(null, 204);
});

export default todos;
