// Trace: SPEC-person-1, SPEC-person-3, TASK-004, TASK-027, TASK-LLM-IMPORT
/**
 * Zod validation schemas for Person entities
 */

import { z } from 'zod';

/**
 * Person ID schema (6-digit string)
 */
export const personIdSchema = z.string().length(6).regex(/^\d{6}$/, 'Person ID must be 6 digits');

/**
 * Phone extension schema (up to 15 characters, digits and hyphens allowed)
 */
export const phoneExtSchema = z.string().max(15).regex(/^[\d-]+$/, 'Phone must contain only digits and hyphens').optional();

/**
 * Employment status schema
 */
export const employmentStatusSchema = z.enum(['재직', '휴직', '퇴직']).default('재직');

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
  employmentStatus: employmentStatusSchema.optional(),
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
  employmentStatus: employmentStatusSchema.optional(),
});

/**
 * Import person from text request schema
 */
export const importPersonFromTextSchema = z.object({
  text: z.string().min(1, 'Text is required').max(5000),
});

/**
 * Parsed person data from LLM
 */
export const parsedPersonDataSchema = z.object({
  personId: personIdSchema,
  name: z.string().min(1).max(100),
  phoneExt: phoneExtSchema,
  currentDept: z.string().max(100).optional(),
  currentPosition: z.string().max(100).optional(),
  currentRoleDesc: z.string().max(500).optional(),
  employmentStatus: employmentStatusSchema,
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
export type ImportPersonFromTextInput = z.infer<typeof importPersonFromTextSchema>;
export type ParsedPersonData = z.infer<typeof parsedPersonDataSchema>;
