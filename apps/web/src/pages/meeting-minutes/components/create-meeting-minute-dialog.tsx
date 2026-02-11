import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { Button } from '@web/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useCreateMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useState } from 'react';

interface CreateMeetingMinuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMeetingMinuteDialog({ open, onOpenChange }: CreateMeetingMinuteDialogProps) {
  const [meetingDate, setMeetingDate] = useState('');
  const [topic, setTopic] = useState('');
  const [detailsRaw, setDetailsRaw] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [generatedKeywords, setGeneratedKeywords] = useState<string[]>([]);
  const { toast } = useToast();

  const createMutation = useCreateMeetingMinute();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const result = await createMutation.mutateAsync({
        meetingDate,
        topic: topic.trim(),
        detailsRaw: detailsRaw.trim(),
        attendeePersonIds: selectedPersonIds,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      });
      setGeneratedKeywords(result.keywords ?? []);
    } catch {
      // Error is handled by mutation hook toast.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>회의록 생성</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid gap-2">
            <Label htmlFor="meeting-date">회의일</Label>
            <Input
              id="meeting-date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meeting-topic">토픽</Label>
            <Input
              id="meeting-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="회의 주제를 입력하세요"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meeting-details">회의 내용</Label>
            <Textarea
              id="meeting-details"
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
              idPrefix="meeting-category"
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

          {generatedKeywords.length > 0 && (
            <div className="grid gap-2">
              <Label>키워드</Label>
              <div className="flex flex-wrap gap-2">
                {generatedKeywords.map((keyword) => (
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
