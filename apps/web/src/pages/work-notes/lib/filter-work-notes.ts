import type { WorkNoteWithStats } from '@web/types/api';
import { startOfWeek } from 'date-fns';
import type { SortDirection, SortKey } from '../components/work-notes-table';
import { createWorkNotesComparator } from './sort-work-notes';

export interface FilteredWorkNotes {
  activeWorkNotes: WorkNoteWithStats[];
  pendingWorkNotes: WorkNoteWithStats[];
  completedTodayWorkNotes: WorkNoteWithStats[];
  completedWeekWorkNotes: WorkNoteWithStats[];
  completedAllWorkNotes: WorkNoteWithStats[];
}

export type CompletedYearFilter = 'all' | `${number}`;

export function isCompleted(workNote: WorkNoteWithStats): boolean {
  return (
    workNote.todoStats.total > 0 &&
    workNote.todoStats.remaining === 0 &&
    workNote.todoStats.pending === 0
  );
}

export function getCompletedAt(workNote: WorkNoteWithStats): Date | null {
  return workNote.latestCompletedAt ? new Date(workNote.latestCompletedAt) : null;
}

export function isInRange(completedAt: Date | null, start: Date, end?: Date): boolean {
  return Boolean(completedAt && completedAt >= start && (!end || completedAt < end));
}

export function filterWorkNotes(
  workNotes: WorkNoteWithStats[],
  sortKey: SortKey,
  sortDirection: SortDirection,
  now: Date = new Date()
): FilteredWorkNotes {
  const sortWorkNotes = createWorkNotesComparator(sortKey, sortDirection);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeekDate = startOfWeek(now, { weekStartsOn: 1 });

  // 진행 중: 할일이 없거나 현재 활성화된 할일이 있는 업무노트
  const activeWorkNotes = workNotes
    .filter((wn) => wn.todoStats.total === 0 || wn.todoStats.remaining > 0)
    .sort(sortWorkNotes);

  // 대기중: 남은 할일이 없고 대기 중인 할일만 있는 업무노트
  const pendingWorkNotes = workNotes
    .filter((wn) => wn.todoStats.remaining === 0 && wn.todoStats.pending > 0)
    .sort(sortWorkNotes);

  const completedAllWorkNotes = workNotes.filter(isCompleted).sort(sortWorkNotes);

  // Exclusive ranges: today only, week excluding today, year excluding week
  const completedTodayWorkNotes = completedAllWorkNotes.filter((wn) =>
    isInRange(getCompletedAt(wn), startOfToday)
  );
  const completedWeekWorkNotes = completedAllWorkNotes.filter((wn) =>
    isInRange(getCompletedAt(wn), startOfWeekDate, startOfToday)
  );

  return {
    activeWorkNotes,
    pendingWorkNotes,
    completedTodayWorkNotes,
    completedWeekWorkNotes,
    completedAllWorkNotes,
  };
}

export function getCompletedYears(
  completedWorkNotes: WorkNoteWithStats[],
  now: Date = new Date()
): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const workNote of completedWorkNotes) {
    const completedAt = getCompletedAt(workNote);
    if (completedAt) {
      years.add(completedAt.getFullYear());
    }
  }
  return [...years].sort((a, b) => b - a);
}

export function filterCompletedWorkNotesByYear(
  completedWorkNotes: WorkNoteWithStats[],
  yearFilter: CompletedYearFilter
): WorkNoteWithStats[] {
  if (yearFilter === 'all') {
    return completedWorkNotes;
  }

  const targetYear = Number(yearFilter);
  if (Number.isNaN(targetYear)) {
    return [];
  }

  return completedWorkNotes.filter((workNote) => {
    const completedAt = getCompletedAt(workNote);
    return Boolean(completedAt && completedAt.getFullYear() === targetYear);
  });
}
