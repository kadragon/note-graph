// Trace: SPEC-dept-1, TASK-004
/**
 * Zod validation schemas for Department entities
 */

import { z } from 'zod';

/**
 * Create department request schema
 */
export const createDepartmentSchema = z.object({
  deptName: z.string().min(1, 'Department name is required').max(100),
  description: z.string().max(500).optional(),
});

/**
 * Update department request schema
 */
export const updateDepartmentSchema = z.object({
  description: z.string().max(500).optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
