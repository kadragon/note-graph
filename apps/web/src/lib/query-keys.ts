import type { TodoView } from '@web/types/api';

export const qk = {
  todosRoot: () => ['todos'] as const,
  todos: (view: TodoView = 'today', year?: number) => ['todos', view, year] as const,

  workNotes: () => ['work-notes'] as const,
  workNotesWithStats: () => ['work-notes-with-stats'] as const,
  workNoteDetail: (workId: string | null | undefined) => ['work-note-detail', workId] as const,
  workNoteTodos: (workId: string | null | undefined) => ['work-note-todos', workId] as const,
  workNoteFiles: (workId: string | null | undefined) => ['work-note-files', workId] as const,

  googleDriveStatus: () => ['google-drive-status'] as const,
  pdfJob: (jobId: string | null) => ['pdf-job', jobId] as const,
};
