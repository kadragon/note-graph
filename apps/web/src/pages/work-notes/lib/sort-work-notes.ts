import type { WorkNoteWithStats } from '@web/types/api';
import type { SortDirection, SortKey } from '../components/work-notes-table';

export const createWorkNotesComparator = (sortKey: SortKey, sortDirection: SortDirection) => {
  const direction = sortDirection === 'asc' ? 1 : -1;

  const getValue = (wn: WorkNoteWithStats) => {
    switch (sortKey) {
      case 'category':
        return wn.categories?.[0]?.name ?? '';
      case 'dueDate':
        return wn.latestTodoDate ? new Date(wn.latestTodoDate).getTime() : Number.MAX_VALUE;
      case 'title':
        return wn.title;
      case 'assignee':
        return wn.persons?.[0]?.personName ?? '';
      case 'todo':
        return wn.todoStats.remaining;
      case 'createdAt':
        return new Date(wn.createdAt).getTime();
      default:
        return '';
    }
  };

  return (a: WorkNoteWithStats, b: WorkNoteWithStats) => {
    const valueA = getValue(a);
    const valueB = getValue(b);

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return valueA.localeCompare(valueB, 'ko') * direction;
    }
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return (valueA - valueB) * direction;
    }
    return 0;
  };
};
