import { AssigneeSelector } from '@web/components/assignee-selector';
import { CategorySelector } from '@web/components/category-selector';
import { GroupSelector } from '@web/components/group-selector';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useMeetingMinute, useUpdateMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useWorkNoteGroups } from '@web/hooks/use-work-note-groups';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function MeetingMinuteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meetingDate, setMeetingDate] = useState('');
  const [topic, setTopic] = useState('');
  const [detailsRaw, setDetailsRaw] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const { toast } = useToast();
  const formInitializedForId = useRef<string | undefined>(undefined);

  const updateMutation = useUpdateMeetingMinute();
  const detailQuery = useMeetingMinute(id, Boolean(id));
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: groups = [], isLoading: groupsLoading } = useWorkNoteGroups(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

  useEffect(() => {
    if (!detailQuery.data || formInitializedForId.current === id) return;
    const detail = detailQuery.data;
    setMeetingDate(detail.meetingDate);
    setTopic(detail.topic);
    setDetailsRaw(detail.detailsRaw);
    setSelectedCategoryIds(detail.categories.map((category) => category.categoryId));
    setSelectedGroupIds(detail.groups?.map((group) => group.groupId) ?? []);
    setSelectedPersonIds(detail.attendees.map((attendee) => attendee.personId));
    setKeywords(detail.keywords ?? []);
    formInitializedForId.current = id;
  }, [detailQuery.data, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
      toast({ variant: 'destructive', title: '오류', description: '회의록 ID가 필요합니다.' });
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
        meetingId: id,
        data: {
          meetingDate,
          topic: topic.trim(),
          detailsRaw: detailsRaw.trim(),
          attendeePersonIds: selectedPersonIds,
          categoryIds: selectedCategoryIds,
          groupIds: selectedGroupIds,
        },
      });
      setKeywords(result.keywords ?? []);
      navigate(`/meeting-minutes/${id}`, { replace: true });
    } catch {
      // Error is handled by mutation hook toast.
    }
  };

  if (!id) {
    return (
      <div className="page-container py-24 text-center">
        <p className="text-muted-foreground">회의록 ID가 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/meeting-minutes')}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="page-container flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="page-container py-24 text-center">
        <p className="text-muted-foreground">회의록 정보를 불러오지 못했습니다.</p>
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" onClick={() => void detailQuery.refetch()}>
            다시 시도
          </Button>
          <Button variant="outline" onClick={() => navigate('/meeting-minutes')}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <div>
            <h1 className="page-title">회의록 수정</h1>
            <p className="page-description">회의록 내용을 수정합니다.</p>
          </div>
        </div>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>회의 정보</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Label>업무 그룹 (선택사항)</Label>
              <GroupSelector
                groups={groups}
                selectedIds={selectedGroupIds}
                onSelectionChange={setSelectedGroupIds}
                isLoading={groupsLoading}
                idPrefix="edit-meeting-group"
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
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                취소
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
