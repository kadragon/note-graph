// Trace: Phase 5.1 - Consolidate Mappers
// Transform backend todo format to frontend format

import type {
  CustomIntervalUnit,
  RecurrenceType,
  RepeatRule,
  Todo,
  TodoPriority,
  TodoStatus,
} from '@web/types/models/todo';

/**
 * Backend todo response format
 * Maps to database schema
 */
export interface BackendTodo {
  todoId: string;
  workId: string;
  title: string;
  description?: string;
  priority: number;
  status: TodoStatus;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
  customInterval?: number;
  customUnit?: CustomIntervalUnit;
  skipWeekends?: boolean;
  createdAt: string;
  updatedAt: string;
  workTitle?: string;
  workCategory?: string;
}

/**
 * Transform backend todo response to frontend Todo format
 */
export function transformTodoFromBackend(backendTodo: BackendTodo): Todo {
  return {
    id: backendTodo.todoId,
    workNoteId: backendTodo.workId,
    workTitle: backendTodo.workTitle,
    workCategory: backendTodo.workCategory,
    title: backendTodo.title,
    description: backendTodo.description,
    priority: (backendTodo.priority ?? 3) as TodoPriority,
    status: backendTodo.status,
    dueDate: backendTodo.dueDate,
    waitUntil: backendTodo.waitUntil,
    repeatRule: backendTodo.repeatRule,
    recurrenceType: backendTodo.recurrenceType,
    customInterval: backendTodo.customInterval,
    customUnit: backendTodo.customUnit,
    skipWeekends: backendTodo.skipWeekends,
    createdAt: backendTodo.createdAt,
    updatedAt: backendTodo.updatedAt,
  };
}
