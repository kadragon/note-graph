import { Button } from '@web/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@web/components/ui/dialog';
import { useMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { formatDateTimeInKstOrFallback } from '@web/lib/date-format';

interface ViewMeetingMinuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
  onEdit: (meetingId: string) => void;
}

export function ViewMeetingMinuteDialog({
  open,
  onOpenChange,
  meetingId,
  onEdit,
}: ViewMeetingMinuteDialogProps) {
  const detailQuery = useMeetingMinute(meetingId, open && Boolean(meetingId));

  const handleEdit = () => {
    if (!meetingId) {
      return;
    }
    onEdit(meetingId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>회의록 보기</DialogTitle>
        </DialogHeader>

        {!meetingId ? (
          <p className="text-sm text-muted-foreground">조회할 회의록을 선택해주세요.</p>
        ) : detailQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">회의록 정보를 불러오는 중...</p>
        ) : detailQuery.isError || !detailQuery.data ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">회의록 정보를 불러오지 못했습니다.</p>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void detailQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {detailQuery.data.linkedWorkNoteCount !== undefined && (
              <p className="text-sm text-muted-foreground">
                연결된 업무노트: {detailQuery.data.linkedWorkNoteCount}건
              </p>
            )}

            <div className="grid gap-1">
              <p className="text-sm font-medium">회의일</p>
              <p className="text-sm">{detailQuery.data.meetingDate}</p>
            </div>

            <div className="grid gap-1">
              <p className="text-sm font-medium">토픽</p>
              <p className="text-sm">{detailQuery.data.topic}</p>
            </div>

            <div className="grid gap-1">
              <p className="text-sm font-medium">회의 내용</p>
              <p className="text-sm whitespace-pre-wrap">{detailQuery.data.detailsRaw}</p>
            </div>

            <div className="grid gap-1">
              <p className="text-sm font-medium">참석자</p>
              <div className="flex flex-wrap gap-2">
                {detailQuery.data.attendees.length > 0 ? (
                  detailQuery.data.attendees.map((attendee) => (
                    <span
                      key={attendee.personId}
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                    >
                      {attendee.name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">참석자가 없습니다.</p>
                )}
              </div>
            </div>

            <div className="grid gap-1">
              <p className="text-sm font-medium">업무 구분</p>
              <div className="flex flex-wrap gap-2">
                {detailQuery.data.categories.length > 0 ? (
                  detailQuery.data.categories.map((category) => (
                    <span
                      key={category.categoryId}
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                    >
                      {category.name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">업무 구분이 없습니다.</p>
                )}
              </div>
            </div>

            <div className="grid gap-1">
              <p className="text-sm font-medium">키워드</p>
              <div className="flex flex-wrap gap-2">
                {detailQuery.data.keywords.length > 0 ? (
                  detailQuery.data.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">키워드가 없습니다.</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              생성일: {formatDateTimeInKstOrFallback(detailQuery.data.createdAt)} | 수정일:{' '}
              {formatDateTimeInKstOrFallback(detailQuery.data.updatedAt)}
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              <Button type="button" onClick={handleEdit}>
                수정
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
