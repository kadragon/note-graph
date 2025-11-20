import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Trash2, CheckCircle2, Circle } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WorkNoteWithStats } from '@/types/api';

interface WorkNoteRowProps {
  workNote: WorkNoteWithStats;
  onView: (workNote: WorkNoteWithStats) => void;
  onDelete: (workNoteId: string) => void;
}

export function WorkNoteRow({ workNote, onView, onDelete }: WorkNoteRowProps) {
  const { total, remaining, completed } = workNote.todoStats;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <button
          onClick={() => onView(workNote)}
          className="text-left hover:text-blue-600 hover:underline w-full cursor-pointer"
        >
          {workNote.title}
        </button>
      </TableCell>
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
      <TableCell>
        {total > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {remaining === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <span className="text-sm font-medium">
              <span className={remaining === 0 ? 'text-green-600' : 'text-blue-600'}>
                {remaining}
              </span>
              <span className="text-muted-foreground"> / {total}</span>
            </span>
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
