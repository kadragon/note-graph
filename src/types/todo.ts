// Trace: SPEC-todo-1, TASK-008
/**
 * Type definitions for Todo entities
 */

/**
 * Todo status (Korean values)
 */
export type TodoStatus = '진행중' | '완료' | '보류' | '중단';

/**
 * Repeat rule for recurring todos
 */
export type RepeatRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

/**
 * Recurrence type strategy
 */
export type RecurrenceType = 'DUE_DATE' | 'COMPLETION_DATE';

/**
 * Todo entity
 */
export interface Todo {
  todoId: string; // TODO-{nanoid}
  workId: string;
  title: string;
  description: string | null;
  createdAt: string; // ISO 8601 timestamp
  dueDate: string | null; // ISO 8601 timestamp
  waitUntil: string | null; // ISO 8601 timestamp
  status: TodoStatus;
  repeatRule: RepeatRule;
  recurrenceType: RecurrenceType | null;
}

/**
 * Todo with work note title (for display)
 */
export interface TodoWithWorkNote extends Todo {
  workTitle?: string;
}
