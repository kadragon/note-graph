import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@web/components/ui/dialog';

interface EditMeetingMinuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
}

export function EditMeetingMinuteDialog({
  open,
  onOpenChange,
  meetingId,
}: EditMeetingMinuteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>회의록 수정</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">ID: {meetingId ?? '-'}</p>
      </DialogContent>
    </Dialog>
  );
}
