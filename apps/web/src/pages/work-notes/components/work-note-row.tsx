import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { TableCell, TableRow } from '@web/components/ui/table';
import { useDownloadWorkNote } from '@web/hooks/use-download-work-note';
import type { WorkNoteWithStats } from '@web/types/api';
import { differenceInDays, format, parseISO, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Download, Loader2, Trash2 } from 'lucide-react';

interface WorkNoteRowProps {
  workNote: WorkNoteWithStats;
  onView: (workNote: WorkNoteWithStats) => void;
  onDelete: (workNoteId: string) => void;
}

function getDdayInfo(dateString: string | null): {
  text: string;
  colorClass: string;
  bgClass: string;
} | null {
  if (!dateString) return null;

  const today = startOfDay(new Date());
  const targetDate = startOfDay(parseISO(dateString));
  const diff = differenceInDays(targetDate, today);

  if (diff < 0) {
    // Overdue
    return {
      text: `D+${Math.abs(diff)}`,
      colorClass: 'text-red-600',
      bgClass: 'bg-red-50',
    };
  }
  if (diff === 0) {
    // Today
    return {
      text: '오늘',
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
    };
  }
  if (diff <= 3) {
    // Due within 3 days
    return {
      text: `D-${diff}`,
      colorClass: 'text-orange-500',
      bgClass: 'bg-orange-50',
    };
  }
  if (diff <= 7) {
    // Due within 7 days
    return {
      text: `D-${diff}`,
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-50',
    };
  }
  // More than 7 days
  return {
    text: `D-${diff}`,
    colorClass: 'text-gray-500',
    bgClass: 'bg-gray-50',
  };
}

export function WorkNoteRow({ workNote, onView, onDelete }: WorkNoteRowProps) {
  const { total, completed } = workNote.todoStats;
  const ddayInfo = getDdayInfo(workNote.latestTodoDate);
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const { downloadWorkNote, isDownloading } = useDownloadWorkNote();

  return (
    <TableRow>
      <TableCell>
        {workNote.categories && workNote.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {workNote.categories.map((category) => (
              <Badge key={category.categoryId} variant="secondary">
                {category.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="w-24">
        {ddayInfo && workNote.latestTodoDate ? (
          <div className="flex flex-col items-start gap-0.5">
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${ddayInfo.colorClass} ${ddayInfo.bgClass}`}
            >
              {ddayInfo.text}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(workNote.latestTodoDate), 'MM/dd', { locale: ko })}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="font-medium">
        <button
          type="button"
          onClick={() => onView(workNote)}
          className="text-left hover:text-blue-600 hover:underline w-full cursor-pointer"
        >
          {workNote.title}
        </button>
      </TableCell>
      <TableCell>
        {workNote.persons && workNote.persons.length > 0 ? (
          <div className="flex flex-col gap-1">
            {workNote.persons.map((person) => {
              const orgParts = [person.currentDept, person.currentPosition].filter(Boolean);
              const contactParts = [person.personId, person.phoneExt].filter(Boolean);
              return (
                <div key={person.personId} className="text-sm">
                  <span className="font-medium">{person.personName}</span>
                  {orgParts.length > 0 && (
                    <span className="text-muted-foreground ml-1">({orgParts.join('/')})</span>
                  )}
                  {contactParts.length > 0 && (
                    <span className="text-muted-foreground text-xs ml-1">
                      · {contactParts.join(' · ')}
                    </span>
                  )}
                </div>
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
      <TableCell className="text-muted-foreground text-xs">
        {format(parseISO(workNote.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
  );
}
