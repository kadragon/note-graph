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
export type RepeatRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

/**
 * Recurrence type strategy
 */
export type RecurrenceType = 'DUE_DATE' | 'COMPLETION_DATE';

/**
 * Custom interval unit for CUSTOM repeat rule
 */
export type CustomIntervalUnit = 'DAY' | 'WEEK' | 'MONTH';

/**
 * Todo entity
 */
export interface Todo {
  todoId: string; // TODO-{nanoid}
  workId: string;
  title: string;
  description: string | null;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  dueDate: string | null; // ISO 8601 timestamp
  waitUntil: string | null; // ISO 8601 timestamp
  status: TodoStatus;
  repeatRule: RepeatRule;
  recurrenceType: RecurrenceType | null;
  customInterval: number | null; // For CUSTOM repeat rule (e.g., 2 for "every 2 months")
  customUnit: CustomIntervalUnit | null; // Unit for custom interval (DAY, WEEK, MONTH)
  skipWeekends: boolean; // Skip weekends when calculating next due date
}

/**
 * Todo with work note title and category (for display)
 */
export interface TodoWithWorkNote extends Todo {
  workTitle?: string;
  workCategory?: string;
}
