import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { qk } from '@web/lib/query-keys';

export interface WorkNoteRelatedKeyOptions {
  includeTodos?: boolean;
  includeWorkNotes?: boolean;
  includeWorkNotesWithStats?: boolean;
  includeDetail?: boolean;
  includeWorkNoteTodos?: boolean;
  includeFiles?: boolean;
}

export function invalidateMany(queryClient: QueryClient, keys: readonly QueryKey[]): void {
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

export function workNoteRelatedKeys(
  workId?: string | null,
  options: WorkNoteRelatedKeyOptions = {}
): QueryKey[] {
  const {
    includeTodos = false,
    includeWorkNotes = true,
    includeWorkNotesWithStats = true,
    includeDetail = false,
    includeWorkNoteTodos = false,
    includeFiles = false,
  } = options;

  const keys: QueryKey[] = [];

  if (includeTodos) keys.push(qk.todosRoot());
  if (includeWorkNotes) keys.push(qk.workNotes());
  if (includeWorkNotesWithStats) keys.push(qk.workNotesWithStats());

  if (workId) {
    if (includeDetail) keys.push(qk.workNoteDetail(workId));
    if (includeWorkNoteTodos) keys.push(qk.workNoteTodos(workId));
    if (includeFiles) keys.push(qk.workNoteFiles(workId));
  }

  return keys;
}
