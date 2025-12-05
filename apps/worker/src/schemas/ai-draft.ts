// Trace: SPEC-ai-draft-1, TASK-013
import { z } from 'zod';

/**
 * Draft from text request schema
 */
export const DraftFromTextRequestSchema = z.object({
  inputText: z.string().min(1, 'Input text is required'),
  category: z.string().optional(),
  personIds: z.array(z.string()).optional(),
  deptName: z.string().optional(),
});

export type DraftFromTextRequest = z.infer<typeof DraftFromTextRequestSchema>;

/**
 * Todo suggestions request schema
 */
export const TodoSuggestionsRequestSchema = z.object({
  contextText: z.string().optional(),
});

export type TodoSuggestionsRequest = z.infer<typeof TodoSuggestionsRequestSchema>;
