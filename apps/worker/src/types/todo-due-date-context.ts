// Trace: SPEC-ai-draft-due-date-context-1
/**
 * Aggregated due date distribution context for AI prompt guidance.
 */

export interface TodoDueDateCount {
  dueDate: string; // YYYY-MM-DD
  count: number;
}

export interface OpenTodoDueDateContextForAI {
  totalOpenTodos: number;
  undatedOpenTodos: number;
  topDueDateCounts: TodoDueDateCount[];
}
