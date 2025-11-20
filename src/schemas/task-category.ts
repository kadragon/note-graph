// Trace: SPEC-taskcategory-1, TASK-003
/**
 * Zod validation schemas for TaskCategory entities
 */

import { z } from 'zod';

/**
 * Create task category request schema
 */
export const createTaskCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
});

/**
 * Update task category request schema
 */
export const updateTaskCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Query parameters for listing task categories (search)
 */
export const listTaskCategoriesQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  activeOnly: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

export type CreateTaskCategoryInput = z.infer<typeof createTaskCategorySchema>;
export type UpdateTaskCategoryInput = z.infer<typeof updateTaskCategorySchema>;
export type ListTaskCategoriesQuery = z.infer<typeof listTaskCategoriesQuerySchema>;
