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
export const repeatRuleSchema = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']);

/**
 * Recurrence type enum
 */
export const recurrenceTypeSchema = z.enum(['DUE_DATE', 'COMPLETION_DATE']);

/**
 * Custom interval unit enum
 */
export const customIntervalUnitSchema = z.enum(['DAY', 'WEEK', 'MONTH']);

// ISO 8601 date format: YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// ISO 8601 datetime format
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Date or datetime schema
 * Accepts both ISO 8601 date (YYYY-MM-DD) and datetime (YYYY-MM-DDTHH:mm:ssZ) formats
 */
const dateOrDatetimeSchema = z
  .string()
  .refine((val) => DATE_REGEX.test(val) || DATETIME_REGEX.test(val), {
    message: 'Must be a valid ISO 8601 date (YYYY-MM-DD) or datetime string',
  });

/**
 * Create todo request schema
 */
export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  dueDate: dateOrDatetimeSchema.optional(),
  waitUntil: z
    .string()
    .datetime({ message: 'waitUntil must be a valid ISO 8601 date-time string' })
    .optional(),
  repeatRule: repeatRuleSchema.default('NONE'),
  recurrenceType: recurrenceTypeSchema.optional(),
  customInterval: z.number().int().min(1).max(365).optional(),
  customUnit: customIntervalUnitSchema.optional(),
  skipWeekends: z.boolean().default(false),
});

/**
 * Update todo request schema
 */
export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: todoStatusSchema.optional(),
  dueDate: dateOrDatetimeSchema.optional(),
  waitUntil: z
    .string()
    .datetime({ message: 'waitUntil must be a valid ISO 8601 date-time string' })
    .optional(),
  repeatRule: repeatRuleSchema.optional(),
  recurrenceType: recurrenceTypeSchema.optional(),
  customInterval: z.number().int().min(1).max(365).optional().nullable(),
  customUnit: customIntervalUnitSchema.optional().nullable(),
  skipWeekends: z.boolean().optional(),
});

/**
 * Query parameters for listing todos
 */
export const listTodosQuerySchema = z.object({
  view: z.enum(['today', 'week', 'month', 'remaining', 'completed', 'backlog']).default('today'),
  status: todoStatusSchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type RepeatRule = z.infer<typeof repeatRuleSchema>;
export type RecurrenceType = z.infer<typeof recurrenceTypeSchema>;
export type CustomIntervalUnit = z.infer<typeof customIntervalUnitSchema>;
