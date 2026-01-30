import { Table, TableBody, TableHead, TableHeader, TableRow } from '@web/components/ui/table';
import type { WorkNoteWithStats } from '@web/types/api';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { WorkNoteRow } from './work-note-row';

export type SortKey = 'category' | 'dueDate' | 'title' | 'assignee' | 'todo' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

interface WorkNotesTableProps {
  workNotes: WorkNoteWithStats[];
  onView: (workNote: WorkNoteWithStats) => void;
  onDelete: (workNoteId: string) => void;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center justify-center gap-1 w-full hover:text-foreground transition-colors cursor-pointer"
      >
        {label}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
        )}
      </button>
    </TableHead>
  );
}

export function WorkNotesTable({
  workNotes,
  onView,
  onDelete,
  sortKey,
  sortDirection,
  onSort,
}: WorkNotesTableProps) {
  if (workNotes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">업무노트가 없습니다.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            label="업무 구분"
            sortKey="category"
            currentSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="마감일"
            sortKey="dueDate"
            currentSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
            className="w-24"
          />
          <SortableHeader
            label="제목"
            sortKey="title"
            currentSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="담당자"
            sortKey="assignee"
            currentSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="할일"
            sortKey="todo"
            currentSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
            className="w-28"
          />
          <SortableHeader
            label="생성일"
            sortKey="createdAt"
            currentSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
            className="w-36"
          />
          <TableHead className="text-center w-20">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workNotes.map((workNote) => (
          <WorkNoteRow key={workNote.id} workNote={workNote} onView={onView} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  );
}
