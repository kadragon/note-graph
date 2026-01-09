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
  describe('dueDate sorting', () => {
    it('should place missing due dates after dated rows when sorting descending', () => {
      const workNotes = [
        baseWorkNote({ id: 'NO-DATE', latestTodoDate: null }),
        baseWorkNote({ id: 'EARLY', latestTodoDate: '2025-01-02T00:00:00Z' }),
        baseWorkNote({ id: 'LATE', latestTodoDate: '2025-02-01T00:00:00Z' }),
      ];

      const sorted = [...workNotes].sort(createWorkNotesComparator('dueDate', 'desc'));

      expect(sorted.map((workNote) => workNote.id)).toEqual(['LATE', 'EARLY', 'NO-DATE']);
    });

    it('should place missing due dates after dated rows when sorting ascending', () => {
      const workNotes = [
        baseWorkNote({ id: 'NO-DATE', latestTodoDate: null }),
        baseWorkNote({ id: 'EARLY', latestTodoDate: '2025-01-02T00:00:00Z' }),
        baseWorkNote({ id: 'LATE', latestTodoDate: '2025-02-01T00:00:00Z' }),
      ];

      const sorted = [...workNotes].sort(createWorkNotesComparator('dueDate', 'asc'));

      expect(sorted.map((workNote) => workNote.id)).toEqual(['EARLY', 'LATE', 'NO-DATE']);
    });
  });

  describe('title sorting', () => {
    it('should sort by title alphabetically in ascending order', () => {
      const workNotes = [
        baseWorkNote({ id: 'C', title: 'Charlie' }),
        baseWorkNote({ id: 'A', title: 'Alpha' }),
        baseWorkNote({ id: 'B', title: 'Bravo' }),
      ];

      const sorted = [...workNotes].sort(createWorkNotesComparator('title', 'asc'));

      expect(sorted.map((workNote) => workNote.id)).toEqual(['A', 'B', 'C']);
    });

    it('should sort by title alphabetically in descending order', () => {
      const workNotes = [
        baseWorkNote({ id: 'C', title: 'Charlie' }),
        baseWorkNote({ id: 'A', title: 'Alpha' }),
        baseWorkNote({ id: 'B', title: 'Bravo' }),
      ];

      const sorted = [...workNotes].sort(createWorkNotesComparator('title', 'desc'));

      expect(sorted.map((workNote) => workNote.id)).toEqual(['C', 'B', 'A']);
    });
  });

  describe('todo sorting', () => {
    it('should sort by remaining todos in ascending order', () => {
      const workNotes = [
        baseWorkNote({
          id: 'HIGH',
          todoStats: { total: 10, completed: 2, remaining: 8, pending: 0 },
        }),
        baseWorkNote({
          id: 'LOW',
          todoStats: { total: 5, completed: 4, remaining: 1, pending: 0 },
        }),
        baseWorkNote({
          id: 'MID',
          todoStats: { total: 6, completed: 1, remaining: 5, pending: 0 },
        }),
      ];

      const sorted = [...workNotes].sort(createWorkNotesComparator('todo', 'asc'));

      expect(sorted.map((workNote) => workNote.id)).toEqual(['LOW', 'MID', 'HIGH']);
    });

    it('should sort by remaining todos in descending order', () => {
      const workNotes = [
        baseWorkNote({
          id: 'HIGH',
          todoStats: { total: 10, completed: 2, remaining: 8, pending: 0 },
        }),
        baseWorkNote({
          id: 'LOW',
          todoStats: { total: 5, completed: 4, remaining: 1, pending: 0 },
        }),
        baseWorkNote({
          id: 'MID',
          todoStats: { total: 6, completed: 1, remaining: 5, pending: 0 },
        }),
      ];

      const sorted = [...workNotes].sort(createWorkNotesComparator('todo', 'desc'));

      expect(sorted.map((workNote) => workNote.id)).toEqual(['HIGH', 'MID', 'LOW']);
    });
  });
});
