import type { Todo } from '@web/types/api';

/**
 * Returns the most recent dueDate among all todos.
 * @param todos Array of todos
 * @returns The most recent dueDate string (YYYY-MM-DD) or null if no todos have dueDates
 */
export function getLatestTodoDate(todos: Todo[]): string | null {
  const dueDates = todos.map((todo) => todo.dueDate).filter((date): date is string => !!date);

  if (dueDates.length === 0) {
    return null;
  }

  return dueDates.sort().pop() ?? null;
}
