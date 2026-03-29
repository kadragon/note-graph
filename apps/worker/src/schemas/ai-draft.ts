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
  urgent: z.boolean().optional(),
});

export type DraftFromTextRequest = z.infer<typeof DraftFromTextRequestSchema>;

/**
 * Todo suggestions request schema
 */
export const TodoSuggestionsRequestSchema = z.object({
  contextText: z.string().optional(),
});

export type TodoSuggestionsRequest = z.infer<typeof TodoSuggestionsRequestSchema>;

/**
 * Enhance existing work note request schema
 */
export const enhanceWorkNoteRequestSchema = z.object({
  newContent: z.string().min(1, 'New content is required'),
  generateNewTodos: z.boolean().default(true),
});

export type EnhanceWorkNoteRequest = z.infer<typeof enhanceWorkNoteRequestSchema>;

/**
 * Email reply generation request schema
 */
export const EmailReplyRequestSchema = z.object({
  assigneeName: z.string().min(1),
  assigneePosition: z.string().optional(),
  assigneeDept: z.string().optional(),
});

export type EmailReplyRequest = z.infer<typeof EmailReplyRequestSchema>;

/**
 * Agent draft request schema
 */
export const AgentDraftRequestSchema = z.object({
  inputText: z.string().min(1, 'Input text is required'),
  category: z.string().optional(),
  personIds: z.array(z.string()).optional(),
  deptName: z.string().optional(),
  urgent: z.boolean().optional(),
});

export type AgentDraftRequest = z.infer<typeof AgentDraftRequestSchema>;

/**
 * Bulk deadline adjustment request schema
 */
export const BulkDeadlineAdjustRequestSchema = z.object({
  todos: z
    .array(
      z.object({
        todoId: z.string().min(1),
        title: z.string(),
        description: z.string().nullable().optional(),
        dueDate: z.string(),
        workTitle: z.string().optional(),
        workCategory: z.string().nullable().optional(),
      })
    )
    .min(1, 'At least one todo is required'),
});

export type BulkDeadlineAdjustRequest = z.infer<typeof BulkDeadlineAdjustRequestSchema>;
