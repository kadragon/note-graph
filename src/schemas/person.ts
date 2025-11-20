// Trace: SPEC-person-1, SPEC-person-3, TASK-004, TASK-027
/**
 * Zod validation schemas for Person entities
 */

import { z } from 'zod';

/**
 * Person ID schema (6-digit string)
 */
export const personIdSchema = z.string().length(6).regex(/^\d{6}$/, 'Person ID must be 6 digits');

/**
 * Phone extension schema (4-digit string)
 */
export const phoneExtSchema = z.string().length(4).regex(/^\d{4}$/, 'Phone extension must be 4 digits').optional();

/**
 * Create person request schema
 */
export const createPersonSchema = z.object({
  personId: personIdSchema,
  name: z.string().min(1, 'Name is required').max(100),
  phoneExt: phoneExtSchema,
  currentDept: z.string().max(100).optional(),
  currentPosition: z.string().max(100).optional(),
  currentRoleDesc: z.string().max(500).optional(),
});

/**
 * Update person request schema
 */
export const updatePersonSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phoneExt: phoneExtSchema,
  currentDept: z.string().max(100).optional(),
  currentPosition: z.string().max(100).optional(),
  currentRoleDesc: z.string().max(500).optional(),
});

/**
 * Query parameters for listing persons
 */
export const listPersonsQuerySchema = z.object({
  q: z.string().optional(), // Search query
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type ListPersonsQuery = z.infer<typeof listPersonsQuerySchema>;
