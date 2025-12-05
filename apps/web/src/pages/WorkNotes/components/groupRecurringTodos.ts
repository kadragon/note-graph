// Trace: SPEC-todo-2, TASK-052
import type { Todo } from '@web/types/api';

export interface RecurringTodoGroup {
  groupKey: string;
  title: string;
  repeatRule: string;
  todos: Todo[];
}

export interface GroupedTodos {
  recurring: RecurringTodoGroup[];
  standalone: Todo[];
}

/**
 * Normalize title for grouping - trim and lowercase for case-insensitive matching
 */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Group recurring todos by title and repeat rule
 * - Todos with repeatRule !== 'NONE' are grouped by normalized title + repeatRule
 * - Todos with repeatRule === 'NONE' or missing repeatRule remain standalone
 */
export function groupRecurringTodos(todos: Todo[]): GroupedTodos {
  const recurringMap = new Map<string, Todo[]>();
  const standalone: Todo[] = [];

  for (const todo of todos) {
    // Only group todos with a repeat rule
    if (todo.repeatRule && todo.repeatRule !== 'NONE') {
      const groupKey = `${normalizeTitle(todo.title)}_${todo.repeatRule}`;
      const existing = recurringMap.get(groupKey);
      if (existing) {
        existing.push(todo);
      } else {
        recurringMap.set(groupKey, [todo]);
      }
    } else {
      standalone.push(todo);
    }
  }

  // Convert map to array of groups, only include groups with 2+ instances
  // Single instances are moved to standalone
  const recurring: RecurringTodoGroup[] = [];

  for (const [groupKey, groupTodos] of recurringMap.entries()) {
    if (groupTodos.length >= 2) {
      // Multiple instances - create a group
      recurring.push({
        groupKey,
        title: groupTodos[0].title, // Use original title from first todo
        repeatRule: groupTodos[0].repeatRule || 'NONE',
        // Create a shallow copy before sorting to avoid mutating the original array
        todos: [...groupTodos].sort((a, b) => {
          // Sort by due date (or createdAt if no due date)
          const aDate = a.dueDate || a.createdAt;
          const bDate = b.dueDate || b.createdAt;
          return aDate.localeCompare(bDate);
        }),
      });
    } else {
      // Single instance - treat as standalone
      standalone.push(...groupTodos);
    }
  }

  return {
    recurring,
    standalone,
  };
}
