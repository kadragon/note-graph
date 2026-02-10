import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { TableCell, TableRow } from '@web/components/ui/table';
import { useDownloadWorkNote } from '@web/hooks/use-download-work-note';
import type { WorkNoteWithStats } from '@web/types/api';
import { differenceInDays, format, parseISO, startOfDay } from 'date-fns';
import { Download, Loader2, Trash2 } from 'lucide-react';

interface WorkNoteRowProps {
  workNote: WorkNoteWithStats;
  onView: (workNote: WorkNoteWithStats) => void;
  onDelete: (workNoteId: string) => void;
}

function getDueDateColor(dateString: string | null): string | null {
  if (!dateString) return null;

  const today = startOfDay(new Date());
  const targetDate = startOfDay(parseISO(dateString));
  const diff = differenceInDays(targetDate, today);

  if (diff < 0) return 'text-red-600 font-semibold'; // Overdue
  if (diff === 0) return 'text-orange-600 font-semibold'; // Today
  if (diff <= 3) return 'text-orange-500 font-medium'; // 1-3 days
  if (diff <= 7) return 'text-lime-600 font-medium'; // 4-7 days
  return 'text-green-600'; // 8+ days
}

export function WorkNoteRow({ workNote, onView, onDelete }: WorkNoteRowProps) {
  const { total, completed } = workNote.todoStats;
  const dueDateColor = getDueDateColor(workNote.latestTodoDate);
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const { downloadWorkNote, isDownloading } = useDownloadWorkNote();

  return (
    <TableRow>
      <TableCell className="text-center">
        {workNote.categories && workNote.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1 justify-center">
            {workNote.categories.map((category) => (
              <Badge
                key={category.categoryId}
                variant="secondary"
                className="min-w-[4rem] justify-center"
              >
                {category.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="w-20 text-center">
        {workNote.latestTodoDate ? (
          <span className={dueDateColor ?? ''}>
            {format(parseISO(workNote.latestTodoDate), 'M/d')}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="font-medium max-w-xs">
        <button
          type="button"
          onClick={() => onView(workNote)}
          className="text-left hover:text-blue-600 hover:underline w-full cursor-pointer truncate block"
        >
          {workNote.title}
        </button>
      </TableCell>
      <TableCell>
        {workNote.persons && workNote.persons.length > 0 ? (
          <div className="flex flex-wrap gap-1 text-sm">
            {workNote.persons.map((person, index, arr) => {
              const personInfo = [person.currentDept, person.personName].filter(Boolean).join('/');
              return (
                <span key={person.personId}>
                  {personInfo}
                  {index < arr.length - 1 && ', '}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="w-28">
        {total > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className={
                  completed === total ? 'text-green-600 font-medium' : 'text-muted-foreground'
                }
              >
                {completed}/{total}
              </span>
              <span
                className={
                  completed === total ? 'text-green-600 font-medium' : 'text-muted-foreground'
                }
              >
                {progressPercent}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${completed === total ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs text-center">
        {format(parseISO(workNote.createdAt), 'yyyy-MM-dd')}
      </TableCell>
      <TableCell className="text-center">
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadWorkNote(workNote)}
            disabled={isDownloading}
            className="h-8 w-8 p-0"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="sr-only">다운로드</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(workNote.id)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">삭제</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
