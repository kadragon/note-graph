// Trace: SPEC-search-1, TASK-009
import { z } from 'zod';

/**
 * Schema for work note search request
 */
export const searchWorkNotesSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  personId: z.string().optional(),
  deptName: z.string().optional(),
  category: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).optional().default(10),
});

export type SearchWorkNotesInput = z.infer<typeof searchWorkNotesSchema>;

/**
 * Schema for RAG query request
 */
export const ragQuerySchema = z.object({
  query: z.string().min(1, 'Query is required'),
  scope: z.enum(['GLOBAL', 'PERSON', 'DEPARTMENT', 'WORK']).optional().default('GLOBAL'),
  personId: z.string().optional(),
  deptName: z.string().optional(),
  workId: z.string().optional(),
  topK: z.number().int().positive().max(20).optional().default(5),
});

export type RagQueryInput = z.infer<typeof ragQuerySchema>;

/**
 * Schema for AI draft generation from text
 */
export const aiDraftFromTextSchema = z.object({
  inputText: z.string().min(1, 'Input text is required'),
  category: z.string().optional(),
  personIds: z.array(z.string()).optional(),
  deptName: z.string().optional(),
});

export type AiDraftFromTextInput = z.infer<typeof aiDraftFromTextSchema>;

/**
 * Schema for AI todo suggestions request
 */
export const aiTodoSuggestionsSchema = z.object({
  contextText: z.string().optional(),
});

export type AiTodoSuggestionsInput = z.infer<typeof aiTodoSuggestionsSchema>;
