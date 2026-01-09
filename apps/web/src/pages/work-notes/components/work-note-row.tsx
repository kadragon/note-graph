import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { TableCell, TableRow } from '@web/components/ui/table';
import type { WorkNoteWithStats } from '@web/types/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';

interface WorkNoteRowProps {
  workNote: WorkNoteWithStats;
  onView: (workNote: WorkNoteWithStats) => void;
  onDelete: (workNoteId: string) => void;
}

export function WorkNoteRow({ workNote, onView, onDelete }: WorkNoteRowProps) {
  const { total, completed } = workNote.todoStats;

  return (
    <TableRow>
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
        {workNote.persons && workNote.persons.length > 0 ? (
          <div className="flex flex-col gap-1">
            {workNote.persons.map((person) => (
              <div key={person.personId} className="text-sm">
                <span className="font-medium">{person.personName}</span>
                {person.currentDept && (
                  <span className="text-muted-foreground ml-1">({person.currentDept})</span>
                )}
              </div>
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
              {completed === total ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <span className="text-sm font-medium">
              <span className={completed === total ? 'text-green-600' : 'text-blue-600'}>
                {completed}
              </span>
              <span className="text-muted-foreground"> / {total}</span>
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {workNote.latestTodoDate
          ? format(parseISO(workNote.latestTodoDate), 'yyyy-MM-dd', { locale: ko })
          : '-'}
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
