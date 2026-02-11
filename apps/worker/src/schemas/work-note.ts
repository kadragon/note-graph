// Trace: SPEC-worknote-1, TASK-004
/**
 * Zod validation schemas for Work Note entities
 */

import { z } from 'zod';

/**
 * Person association schema
 */
export const workNotePersonSchema = z.object({
  personId: z.string().length(6),
  role: z.enum(['OWNER', 'RELATED']),
});

/**
 * Create work note request schema
 */
export const createWorkNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  contentRaw: z.string().min(1, 'Content is required'),
  category: z.string().max(50).optional(), // Deprecated: use categoryIds instead
  categoryIds: z.array(z.string()).optional(),
  persons: z.array(workNotePersonSchema).optional(),
  relatedWorkIds: z.array(z.string()).optional(),
  relatedMeetingIds: z.array(z.string()).optional(),
  projectId: z.string().optional(), // Optional project assignment
});

/**
 * Update work note request schema
 */
export const updateWorkNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentRaw: z.string().min(1).optional(),
  category: z.string().max(50).optional(), // Deprecated: use categoryIds instead
  categoryIds: z.array(z.string()).optional(),
  persons: z.array(workNotePersonSchema).optional(),
  relatedWorkIds: z.array(z.string()).optional(),
  relatedMeetingIds: z.array(z.string()).optional(),
  projectId: z.string().nullable().optional(), // Optional project assignment (use null to unassign)
});

/**
 * Query parameters for listing work notes
 */
export const listWorkNotesQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  personId: z.string().optional(),
  deptName: z.string().optional(),
  from: z
    .string()
    .datetime({ message: 'from must be a valid ISO 8601 date-time string' })
    .optional(),
  to: z.string().datetime({ message: 'to must be a valid ISO 8601 date-time string' }).optional(),
});

export type CreateWorkNoteInput = z.infer<typeof createWorkNoteSchema>;
export type UpdateWorkNoteInput = z.infer<typeof updateWorkNoteSchema>;
export type ListWorkNotesQuery = z.infer<typeof listWorkNotesQuerySchema>;
export type WorkNotePerson = z.infer<typeof workNotePersonSchema>;
