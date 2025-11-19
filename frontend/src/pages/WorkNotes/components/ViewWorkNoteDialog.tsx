import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { WorkNote } from '@/types/api';

interface ViewWorkNoteDialogProps {
  workNote: WorkNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewWorkNoteDialog({
  workNote,
  open,
  onOpenChange,
}: ViewWorkNoteDialogProps) {
  if (!workNote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl">{workNote.title}</DialogTitle>
            <Badge variant="secondary">{workNote.category}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              생성일:{' '}
              {format(parseISO(workNote.createdAt), 'yyyy년 M월 d일 HH:mm', {
                locale: ko,
              })}
            </p>
            <p>
              수정일:{' '}
              {format(parseISO(workNote.updatedAt), 'yyyy년 M월 d일 HH:mm', {
                locale: ko,
              })}
            </p>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">내용</h3>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-sm">{workNote.content}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
