import { describe, expect, it } from 'vitest';

import { qk } from './query-keys';

describe('qk', () => {
  it('returns stable todo query keys', () => {
    expect(qk.todosRoot()).toEqual(['todos']);
    expect(qk.todos()).toEqual(['todos', 'today', undefined]);
    expect(qk.todos('completed', 2026)).toEqual(['todos', 'completed', 2026]);
  });

  it('returns stable work note query keys', () => {
    expect(qk.workNotes()).toEqual(['work-notes']);
    expect(qk.workNotesWithStats()).toEqual(['work-notes-with-stats']);
    expect(qk.workNoteDetail('work-1')).toEqual(['work-note-detail', 'work-1']);
    expect(qk.workNoteTodos('work-1')).toEqual(['work-note-todos', 'work-1']);
    expect(qk.workNoteFiles('work-1')).toEqual(['work-note-files', 'work-1']);
  });
});
