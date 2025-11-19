import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Eye, Trash2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WorkNote } from '@/types/api';

interface WorkNoteRowProps {
  workNote: WorkNote;
  onView: (workNote: WorkNote) => void;
  onDelete: (workNoteId: string) => void;
}

export function WorkNoteRow({ workNote, onView, onDelete }: WorkNoteRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{workNote.title}</TableCell>
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
      <TableCell className="text-muted-foreground text-xs">
        {format(parseISO(workNote.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(workNote)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">보기</span>
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
