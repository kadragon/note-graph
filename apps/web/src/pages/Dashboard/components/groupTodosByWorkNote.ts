// Trace: SPEC-todo-1, TASK-046
import type { Todo } from '@/types/api';

export interface WorkNoteTodoGroup {
  workNoteId: string | null;
  workTitle: string;
  todos: Todo[];
}

const NO_WORK_NOTE_KEY = 'no-work';
const NO_WORK_NOTE_LABEL = '업무 노트 없음';

/**
 * Group todos by their associated work note while preserving original ordering.
 */
export function groupTodosByWorkNote(todos: Todo[]): WorkNoteTodoGroup[] {
  const groups = new Map<string, WorkNoteTodoGroup>();

  todos.forEach((todo) => {
    const key = todo.workNoteId ?? NO_WORK_NOTE_KEY;
    const workTitle = todo.workTitle ?? NO_WORK_NOTE_LABEL;

    if (!groups.has(key)) {
      groups.set(key, {
        workNoteId: todo.workNoteId ?? null,
        workTitle,
        todos: [],
      });
    }

    groups.get(key)?.todos.push(todo);
  });

  return Array.from(groups.values());
}
