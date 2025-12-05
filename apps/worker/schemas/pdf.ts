// Trace: SPEC-pdf-1, TASK-014
// Zod validation schemas for PDF processing

import { z } from 'zod';

/**
 * PDF Job Status enum
 */
export const pdfJobStatusSchema = z.enum(['PENDING', 'PROCESSING', 'READY', 'ERROR']);

/**
 * PDF Upload Metadata schema
 */
export const pdfUploadMetadataSchema = z.object({
  category: z.string().optional(),
  personIds: z.array(z.string()).optional(),
  deptName: z.string().optional(),
});

/**
 * Work Note Draft schema (from AI generation)
 */
export const workNoteDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  category: z.string(),
  todos: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
    })
  ),
});

/**
 * PDF Job Response schema (for API)
 */
export const pdfJobResponseSchema = z.object({
  jobId: z.string(),
  status: pdfJobStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  errorMessage: z.string().optional(),
  draft: workNoteDraftSchema.optional(),
});

/**
 * Queue message schema
 */
export const pdfQueueMessageSchema = z.object({
  jobId: z.string(),
  r2Key: z.string(),
  metadata: pdfUploadMetadataSchema,
});

/**
 * Request params for GET /pdf-jobs/{jobId}
 */
export const getPdfJobParamsSchema = z.object({
  jobId: z.string().min(1),
});
