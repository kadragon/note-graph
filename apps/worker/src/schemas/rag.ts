// Trace: SPEC-rag-1, TASK-012, TASK-041
import { z } from 'zod';

/**
 * RAG query request schema
 */
export const RagQueryRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  scope: z.enum(['global', 'person', 'department', 'work']).default('global'),
  personId: z.string().optional(),
  deptName: z.string().optional(),
  workId: z.string().optional(),
  topK: z.number().int().positive().max(20).default(5),
});

export type RagQueryRequest = z.infer<typeof RagQueryRequestSchema>;
