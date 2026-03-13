import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { useDraftAutoSave } from '@web/hooks/use-draft-auto-save';
import { useCreateMeetingMinute } from '@web/hooks/use-meeting-minutes';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { useWorkNoteGroups } from '@web/hooks/use-work-note-groups';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MeetingMinuteContentStep } from './components/meeting-minute-content-step';
import type { MeetingMinuteFormData } from './components/meeting-minute-metadata-form';
import { MeetingMinuteMetadataForm } from './components/meeting-minute-metadata-form';

const DRAFT_KEY = 'meeting-minute-draft';

export default function MeetingMinuteCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [meetingDate, setMeetingDate] = useState('');
  const [topic, setTopic] = useState('');
  const [detailsRaw, setDetailsRaw] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

  const createMutation = useCreateMeetingMinute();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: groups = [], isLoading: groupsLoading } = useWorkNoteGroups(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();

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
      key: DRAFT_KEY,
      data: formData,
    });

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
      const result = await createMutation.mutateAsync({
        meetingDate,
        topic: topic.trim(),
        detailsRaw: detailsRaw.trim(),
        attendeePersonIds: selectedPersonIds,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
      });
      clearDraft();
      navigate(`/meeting-minutes/${result.meetingId}`, { replace: true });
    } catch {
      // Error is handled by mutation hook toast.
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <div>
            <h1 className="page-title">회의록 생성</h1>
            <p className="page-description">새로운 회의록을 작성합니다.</p>
          </div>
        </div>
        {draftStatus === 'saved' && <p className="text-xs text-muted-foreground">자동 저장됨</p>}
      </div>

      {restoredDraft && (
        <div className="mx-auto max-w-2xl mb-4">
          <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 dark:border-yellow-700 dark:bg-yellow-950">
            <p className="text-sm">이전에 작성 중이던 내용이 있습니다.</p>
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
              idPrefix="meeting"
            />
          ) : (
            <MeetingMinuteContentStep
              detailsRaw={detailsRaw}
              onDetailsChange={setDetailsRaw}
              onBack={() => setStep(1)}
              onSubmit={() => void handleSubmit()}
              isPending={createMutation.isPending}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
