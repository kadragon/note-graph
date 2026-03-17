import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { useDraftAutoSave } from '@web/hooks/use-draft-auto-save';
import { useMeetingMinute, useUpdateMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useWorkNoteGroups } from '@web/hooks/use-work-note-groups';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { MeetingMinuteContentStep } from './components/meeting-minute-content-step';
import type { MeetingMinuteFormData } from './components/meeting-minute-metadata-form';
import { MeetingMinuteMetadataForm } from './components/meeting-minute-metadata-form';

export default function MeetingMinuteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [meetingDate, setMeetingDate] = useState('');
  const [topic, setTopic] = useState('');
  const [detailsRaw, setDetailsRaw] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [formInitializedForId, setFormInitializedForId] = useState<string | undefined>(undefined);

  const updateMutation = useUpdateMeetingMinute();
  const detailQuery = useMeetingMinute(id, Boolean(id));
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: groups = [], isLoading: groupsLoading } = useWorkNoteGroups(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

  const draftKey = `meeting-minute-draft-${id}`;

  const formData: MeetingMinuteFormData = useMemo(
    () => ({
      meetingDate,
      topic,
      detailsRaw,
      categoryIds: selectedCategoryIds,
      groupIds: selectedGroupIds,
      personIds: selectedPersonIds,
    }),
    [meetingDate, topic, detailsRaw, selectedCategoryIds, selectedGroupIds, selectedPersonIds]
  );

  const { restoredDraft, draftStatus, clearDraft, dismissRestoredDraft } =
    useDraftAutoSave<MeetingMinuteFormData>({
      key: draftKey,
      data: formData,
      enabled: formInitializedForId === id,
    });

  // Initialize form from server data
  useEffect(() => {
    if (!detailQuery.data || formInitializedForId === id) return;
    const detail = detailQuery.data;
    setMeetingDate(detail.meetingDate.slice(0, 10));
    setTopic(detail.topic);
    setDetailsRaw(detail.detailsRaw);
    setSelectedCategoryIds(detail.categories.map((c) => c.categoryId));
    setSelectedGroupIds(detail.groups?.map((g) => g.groupId) ?? []);
    setSelectedPersonIds(detail.attendees.map((a) => a.personId));
    setKeywords(detail.keywords ?? []);
    setFormInitializedForId(id);
  }, [detailQuery.data, id, formInitializedForId]);

  const applyDraft = useCallback(
    (draft: MeetingMinuteFormData) => {
      setMeetingDate(draft.meetingDate.slice(0, 10));
      setTopic(draft.topic);
      setDetailsRaw(draft.detailsRaw);
      setSelectedCategoryIds(draft.categoryIds);
      setSelectedGroupIds(draft.groupIds);
      setSelectedPersonIds(draft.personIds);
      dismissRestoredDraft();
    },
    [dismissRestoredDraft]
  );

  const handleFormDataChange = useCallback((partial: Partial<MeetingMinuteFormData>) => {
    if (partial.meetingDate !== undefined) setMeetingDate(partial.meetingDate);
    if (partial.topic !== undefined) setTopic(partial.topic);
    if (partial.detailsRaw !== undefined) setDetailsRaw(partial.detailsRaw);
    if (partial.categoryIds !== undefined) setSelectedCategoryIds(partial.categoryIds);
    if (partial.groupIds !== undefined) setSelectedGroupIds(partial.groupIds);
    if (partial.personIds !== undefined) setSelectedPersonIds(partial.personIds);
  }, []);

  const handleSubmit = async () => {
    if (!id) return;

    if (!meetingDate || !topic.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '회의 날짜와 주제를 입력해주세요.',
      });
      return;
    }

    if (!detailsRaw.trim()) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '회의 내용을 입력해주세요.',
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
      clearDraft();
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
        {draftStatus === 'saved' && <p className="text-xs text-muted-foreground">자동 저장됨</p>}
      </div>

      {restoredDraft && formInitializedForId === id && (
        <div className="mx-auto max-w-2xl mb-4">
          <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 dark:border-yellow-700 dark:bg-yellow-950">
            <p className="text-sm">이전에 수정 중이던 내용이 있습니다.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={dismissRestoredDraft}>
                무시
              </Button>
              <Button size="sm" onClick={() => applyDraft(restoredDraft)}>
                복원
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className={step === 2 ? 'mx-auto max-w-4xl' : 'mx-auto max-w-2xl'}>
        <CardHeader>
          <CardTitle>
            {step === 1 ? '회의 정보' : '회의 내용'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({step}/2)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <MeetingMinuteMetadataForm
              formData={formData}
              onFormDataChange={handleFormDataChange}
              onNext={() => setStep(2)}
              onCancel={() => navigate(-1)}
              taskCategories={taskCategories}
              categoriesLoading={categoriesLoading}
              groups={groups}
              groupsLoading={groupsLoading}
              persons={persons}
              personsLoading={personsLoading}
              idPrefix="edit-meeting"
              linkedWorkNoteCount={detailQuery.data.linkedWorkNoteCount}
            />
          ) : (
            <MeetingMinuteContentStep
              detailsRaw={detailsRaw}
              onDetailsChange={setDetailsRaw}
              onBack={() => setStep(1)}
              onSubmit={() => void handleSubmit()}
              isPending={updateMutation.isPending}
              keywords={keywords}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
