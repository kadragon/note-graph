import type { Todo } from '@web/types/api';

/**
 * Returns the most recent dueDate among all todos.
 * @param todos Array of todos
 * @returns The most recent dueDate string (YYYY-MM-DD) or null if no todos have dueDates
 */
export function getLatestTodoDate(todos: Todo[]): string | null {
  return todos.reduce<string | null>((latest, todo) => {
    if (todo.dueDate && (!latest || todo.dueDate > latest)) {
      return todo.dueDate;
    }
    return latest;
  }, null);
}
