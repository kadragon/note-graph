import { z } from 'zod';

export const createWorkNoteGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
});

export const updateWorkNoteGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100).optional(),
  isActive: z.boolean().optional(),
});

export const listWorkNoteGroupsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export type CreateWorkNoteGroupInput = z.infer<typeof createWorkNoteGroupSchema>;
export type UpdateWorkNoteGroupInput = z.infer<typeof updateWorkNoteGroupSchema>;
export type ListWorkNoteGroupsQuery = z.infer<typeof listWorkNoteGroupsQuerySchema>;
