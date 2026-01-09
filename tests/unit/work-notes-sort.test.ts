import { createWorkNotesComparator } from '@web/pages/work-notes/lib/sort-work-notes';
import type { WorkNoteWithStats } from '@web/types/api';
import { describe, expect, it } from 'vitest';

const baseWorkNote = (overrides: Partial<WorkNoteWithStats>): WorkNoteWithStats => ({
  id: 'WORK-BASE',
  title: '기본 업무',
  content: '내용',
  category: '기타',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  todoStats: {
    total: 0,
    completed: 0,
    remaining: 0,
    pending: 0,
  },
  latestTodoDate: null,
  ...overrides,
});

describe('createWorkNotesComparator', () => {
  it('should place missing due dates after dated rows when sorting descending', () => {
    const workNotes = [
      baseWorkNote({ id: 'NO-DATE', latestTodoDate: null }),
      baseWorkNote({ id: 'EARLY', latestTodoDate: '2025-01-02T00:00:00Z' }),
      baseWorkNote({ id: 'LATE', latestTodoDate: '2025-02-01T00:00:00Z' }),
    ];

    const sorted = [...workNotes].sort(createWorkNotesComparator('dueDate', 'desc'));

    expect(sorted.map((workNote) => workNote.id)).toEqual(['LATE', 'EARLY', 'NO-DATE']);
  });
});
