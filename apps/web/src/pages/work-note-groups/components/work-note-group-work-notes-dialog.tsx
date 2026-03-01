import { Button } from '@web/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@web/components/ui/dialog';
import { useWorkNoteGroupWorkNotes } from '@web/hooks/use-work-note-groups';
import { formatDateTimeInKstOrFallback } from '@web/lib/date-format';
import type { WorkNoteGroup } from '@web/types/api';

interface WorkNoteGroupWorkNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: WorkNoteGroup | null;
}

export function WorkNoteGroupWorkNotesDialog({
  open,
  onOpenChange,
  group,
}: WorkNoteGroupWorkNotesDialogProps) {
  const workNotesQuery = useWorkNoteGroupWorkNotes(group?.groupId, open && Boolean(group));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>&quot;{group?.name}&quot; 업무노트</DialogTitle>
        </DialogHeader>

        {workNotesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">업무노트 목록을 불러오는 중...</p>
        ) : workNotesQuery.isError ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">업무노트 목록을 불러오지 못했습니다.</p>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void workNotesQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          </div>
        ) : workNotesQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">연결된 업무노트가 없습니다.</p>
        ) : (
          <ul className="grid gap-2">
            {workNotesQuery.data?.map((workNote) => (
              <li key={workNote.workId} className="flex items-center justify-between gap-2 text-sm">
                <a
                  href={`/work-notes?id=${workNote.workId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {workNote.title}
                </a>
                <span className="text-muted-foreground text-xs shrink-0">
                  {formatDateTimeInKstOrFallback(workNote.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
