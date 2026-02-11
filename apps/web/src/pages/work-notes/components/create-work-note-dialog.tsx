// Trace: TASK-024, SPEC-worknote-1

import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { Button } from '@web/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { Textarea } from '@web/components/ui/textarea';
import { useMeetingMinutes } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useCreateWorkNote } from '@web/hooks/use-work-notes';
import { useMemo, useState } from 'react';

interface CreateWorkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkNoteDialog({ open, onOpenChange }: CreateWorkNoteDialogProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'content'>('basic');
  const [title, setTitle] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);
  const [meetingFilterQuery, setMeetingFilterQuery] = useState('');
  const [content, setContent] = useState('');
  const { toast } = useToast();

  const createMutation = useCreateWorkNote();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();
  const { data: meetingMinutesData, isLoading: meetingMinutesLoading } = useMeetingMinutes(
    { page: 1, pageSize: 20 },
    open
  );
  const meetingMinutes = meetingMinutesData?.items ?? [];
  const filteredMeetingMinutes = useMemo(() => {
    const keyword = meetingFilterQuery.trim().toLowerCase();
    if (!keyword) {
      return meetingMinutes;
    }

    return meetingMinutes.filter((meeting) => {
      const searchableText =
        `${meeting.meetingDate} ${meeting.topic} ${meeting.keywords.join(' ')}`.toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [meetingFilterQuery, meetingMinutes]);

  const toggleMeetingSelection = (meetingId: string) => {
    setSelectedMeetingIds((prev) =>
      prev.includes(meetingId) ? prev.filter((id) => id !== meetingId) : [...prev, meetingId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setActiveTab('basic');
      toast({
        variant: 'destructive',
        title: '오류',
        description: '제목을 입력해주세요.',
      });
      return;
    }

    if (!trimmedContent) {
      setActiveTab('content');
      toast({
        variant: 'destructive',
        title: '오류',
        description: '내용을 입력해주세요.',
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        title: trimmedTitle,
        content: trimmedContent,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        relatedPersonIds: selectedPersonIds.length > 0 ? selectedPersonIds : undefined,
        ...(selectedMeetingIds.length > 0 ? { relatedMeetingIds: selectedMeetingIds } : {}),
      });

      // Reset form and close dialog
      setTitle('');
      setSelectedCategoryIds([]);
      setSelectedPersonIds([]);
      setSelectedMeetingIds([]);
      setMeetingFilterQuery('');
      setContent('');
      setActiveTab('basic');
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setActiveTab('basic');
      setMeetingFilterQuery('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>새 업무노트 작성</DialogTitle>
            <DialogDescription>
              새로운 업무노트를 작성합니다. 모든 필드를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'basic' | 'content')}
            className="grid gap-4 py-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">기본 정보</TabsTrigger>
              <TabsTrigger value="content">내용</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" forceMount className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="업무노트 제목을 입력하세요"
                />
              </div>

              <div className="grid gap-2">
                <Label>업무 구분 (선택사항)</Label>
                <CategorySelector
                  categories={taskCategories}
                  selectedIds={selectedCategoryIds}
                  onSelectionChange={setSelectedCategoryIds}
                  isLoading={categoriesLoading}
                  idPrefix="create-category"
                />
              </div>

              <div className="grid gap-2">
                <Label>담당자 (선택사항)</Label>
                {persons.length === 0 && !personsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    등록된 사람이 없습니다. 먼저 사람을 추가해주세요.
                  </p>
                ) : (
                  <AssigneeSelector
                    persons={persons}
                    selectedPersonIds={selectedPersonIds}
                    onSelectionChange={setSelectedPersonIds}
                    isLoading={personsLoading}
                  />
                )}
              </div>

              <div className="grid gap-2">
                <Label>관련 회의록 (선택사항)</Label>
                {meetingMinutesLoading ? (
                  <p className="text-sm text-muted-foreground">회의록 로딩 중...</p>
                ) : meetingMinutes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">등록된 회의록이 없습니다.</p>
                ) : (
                  <div className="grid gap-2">
                    <Input
                      aria-label="회의록 필터"
                      placeholder="회의록 검색"
                      value={meetingFilterQuery}
                      onChange={(e) => setMeetingFilterQuery(e.target.value)}
                    />
                    <div className="grid gap-2 border rounded-md p-3 max-h-[140px] overflow-y-auto">
                      {filteredMeetingMinutes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
                      ) : (
                        filteredMeetingMinutes.map((meeting) => {
                          const isSelected = selectedMeetingIds.includes(meeting.meetingId);
                          return (
                            <label
                              key={meeting.meetingId}
                              htmlFor={`create-related-meeting-${meeting.meetingId}`}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                id={`create-related-meeting-${meeting.meetingId}`}
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleMeetingSelection(meeting.meetingId)}
                              />
                              <span>{meeting.topic}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="content" forceMount className="space-y-2">
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="업무노트 내용을 입력하세요"
                className="min-h-[220px] h-[38vh]"
              />
              <p className="text-xs text-muted-foreground">
                내용 입력 영역을 고정해 세로 스크롤 부담을 줄였습니다.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={createMutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
