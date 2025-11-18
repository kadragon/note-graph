// Trace: SPEC-todo-1, TASK-004
/**
 * Zod validation schemas for Todo entities
 */

import { z } from 'zod';

/**
 * Todo status enum
 */
export const todoStatusSchema = z.enum(['진행중', '완료', '보류', '중단']);

/**
 * Repeat rule enum
 */
export const repeatRuleSchema = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']);

/**
 * Recurrence type enum
 */
export const recurrenceTypeSchema = z.enum(['DUE_DATE', 'COMPLETION_DATE']);

/**
 * Create todo request schema
 */
export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO 8601 date-time string' }).optional(),
  waitUntil: z.string().datetime({ message: 'waitUntil must be a valid ISO 8601 date-time string' }).optional(),
  repeatRule: repeatRuleSchema.default('NONE'),
  recurrenceType: recurrenceTypeSchema.optional(),
});

/**
 * Update todo request schema
 */
export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: todoStatusSchema.optional(),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO 8601 date-time string' }).optional(),
  waitUntil: z.string().datetime({ message: 'waitUntil must be a valid ISO 8601 date-time string' }).optional(),
  repeatRule: repeatRuleSchema.optional(),
  recurrenceType: recurrenceTypeSchema.optional(),
});

/**
 * Query parameters for listing todos
 */
export const listTodosQuerySchema = z.object({
  view: z.enum(['today', 'this_week', 'this_month', 'backlog', 'all']).default('all'),
  status: todoStatusSchema.optional(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type RepeatRule = z.infer<typeof repeatRuleSchema>;
export type RecurrenceType = z.infer<typeof recurrenceTypeSchema>;
