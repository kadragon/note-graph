// Trace: SPEC-project-1, TASK-036
/**
 * Zod validation schemas for Project API endpoints
 */

import { z } from 'zod';

/**
 * Project status enum
 */
export const projectStatusSchema = z.enum(['진행중', '완료', '보류', '중단']);

const projectDateSchema = z.union([z.string().date(), z.string().datetime()]);

/**
 * Create project request body
 */
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  status: projectStatusSchema.optional(),
  tags: z.string().max(500, 'Tags too long').optional(),
  startDate: projectDateSchema.optional(),
  deptName: z.string().optional(),
  participantPersonIds: z.array(z.string()).optional(),
  participantIds: z.array(z.string()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Update project request body
 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: projectStatusSchema.optional(),
  tags: z.string().max(500).optional(),
  startDate: projectDateSchema.optional(),
  actualEndDate: projectDateSchema.optional(),
  deptName: z.string().optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/**
 * List projects query parameters
 */
export const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  deptName: z.string().optional(),
  participantPersonId: z.string().optional(),
  startDateFrom: projectDateSchema.optional(),
  startDateTo: projectDateSchema.optional(),
  includeDeleted: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

/**
 * Add participant request body
 */
export const addParticipantSchema = z.object({
  personId: z.string().min(1, 'Person ID is required'),
  role: z.string().min(1).max(50).optional(),
});

export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

/**
 * Assign work note request body
 */
export const assignWorkNoteSchema = z.object({
  workId: z.string().min(1, 'Work note ID is required'),
});

export type AssignWorkNoteInput = z.infer<typeof assignWorkNoteSchema>;
