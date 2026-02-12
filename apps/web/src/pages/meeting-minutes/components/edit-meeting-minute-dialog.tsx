import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { Button } from '@web/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useMeetingMinute, useUpdateMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useEffect, useState } from 'react';

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
  const [meetingDate, setMeetingDate] = useState('');
  const [topic, setTopic] = useState('');
  const [detailsRaw, setDetailsRaw] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const { toast } = useToast();

  const updateMutation = useUpdateMeetingMinute();
  const detailQuery = useMeetingMinute(meetingId, open && Boolean(meetingId));
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

  useEffect(() => {
    if (!open || !detailQuery.data) {
      return;
    }

    const detail = detailQuery.data;
    setMeetingDate(detail.meetingDate);
    setTopic(detail.topic);
    setDetailsRaw(detail.detailsRaw);
    setSelectedCategoryIds(detail.categories.map((category) => category.categoryId));
    setSelectedPersonIds(detail.attendees.map((attendee) => attendee.personId));
    setKeywords(detail.keywords ?? []);
  }, [open, detailQuery.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!meetingId) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '회의록 ID가 필요합니다.',
      });
      return;
    }

    if (!meetingDate || !topic.trim() || !detailsRaw.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '회의일, 토픽, 회의 내용을 입력해주세요.',
      });
      return;
    }

    if (selectedPersonIds.length === 0) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '참석자를 한 명 이상 선택해주세요.',
      });
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        meetingId,
        data: {
          meetingDate,
          topic: topic.trim(),
          detailsRaw: detailsRaw.trim(),
          attendeePersonIds: selectedPersonIds,
          categoryIds: selectedCategoryIds,
        },
      });
      setKeywords(result.keywords ?? []);
    } catch {
      // Error is handled by mutation hook toast.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>회의록 수정</DialogTitle>
        </DialogHeader>
        {!meetingId ? (
          <p className="text-sm text-muted-foreground">수정할 회의록을 선택해주세요.</p>
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
          <form className="grid gap-4" onSubmit={(e) => void handleSubmit(e)}>
            {detailQuery.data.linkedWorkNoteCount !== undefined && (
              <p className="text-sm text-muted-foreground">
                연결된 업무노트: {detailQuery.data.linkedWorkNoteCount}건
              </p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="edit-meeting-date">회의일</Label>
              <Input
                id="edit-meeting-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-meeting-topic">토픽</Label>
              <Input
                id="edit-meeting-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="회의 주제를 입력하세요"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-meeting-details">회의 내용</Label>
              <Textarea
                id="edit-meeting-details"
                value={detailsRaw}
                onChange={(e) => setDetailsRaw(e.target.value)}
                placeholder="회의 내용을 입력하세요"
                className="min-h-[160px]"
              />
            </div>

            <div className="grid gap-2">
              <Label>업무 구분 (선택사항)</Label>
              <CategorySelector
                categories={taskCategories}
                selectedIds={selectedCategoryIds}
                onSelectionChange={setSelectedCategoryIds}
                isLoading={categoriesLoading}
                idPrefix="edit-meeting-category"
              />
            </div>

            <div className="grid gap-2">
              <Label>참석자</Label>
              <AssigneeSelector
                persons={persons}
                selectedPersonIds={selectedPersonIds}
                onSelectionChange={setSelectedPersonIds}
                isLoading={personsLoading}
              />
            </div>

            {keywords.length > 0 && (
              <div className="grid gap-2">
                <Label>키워드</Label>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
