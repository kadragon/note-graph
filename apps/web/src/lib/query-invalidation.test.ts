import { createTestQueryClient } from '@web/test/setup';
import { describe, expect, it, vi } from 'vitest';

import { invalidateMany, workNoteRelatedKeys } from './query-invalidation';
import { qk } from './query-keys';

describe('invalidateMany', () => {
  it('invalidates every query key in order', () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const keys = [qk.todosRoot(), qk.workNotes(), qk.workNotesWithStats()];
    invalidateMany(queryClient, keys);

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ['todos'] });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: ['work-notes'] });
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, { queryKey: ['work-notes-with-stats'] });
  });
});

describe('workNoteRelatedKeys', () => {
  it('returns work-note list keys by default', () => {
    expect(workNoteRelatedKeys()).toEqual([['work-notes'], ['work-notes-with-stats']]);
  });

  it('includes optional todo/detail/file keys when requested', () => {
    expect(
      workNoteRelatedKeys('work-1', {
        includeTodos: true,
        includeDetail: true,
        includeWorkNoteTodos: true,
        includeFiles: true,
      })
    ).toEqual([
      ['todos'],
      ['work-notes'],
      ['work-notes-with-stats'],
      ['work-note-detail', 'work-1'],
      ['work-note-todos', 'work-1'],
      ['work-note-files', 'work-1'],
    ]);
  });
});
