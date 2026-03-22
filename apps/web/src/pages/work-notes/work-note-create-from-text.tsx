import { AgentProgressDisplay } from '@web/components/agent-progress-display';
import { AssigneeSelector } from '@web/components/assignee-selector';
import { DraftEditorForm } from '@web/components/draft-editor-form';
import { StepProgressIndicator } from '@web/components/step-progress-indicator';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useAgentDraft } from '@web/hooks/use-agent-draft';
import { useGenerateDraftWithSimilar } from '@web/hooks/use-ai-draft';
import { useAIDraftForm } from '@web/hooks/use-ai-draft-form';
import type { ProgressStep } from '@web/hooks/use-step-progress';
import { useStepProgress } from '@web/hooks/use-step-progress';
import { useToast } from '@web/hooks/use-toast';
import { ArrowLeft, Bot, FileEdit, Sparkles } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const textSteps: ProgressStep[] = [
  { label: '유사 업무노트 및 회의록 검색 중...', durationMs: 3000 },
  { label: 'AI 초안 생성 중...', durationMs: 0 },
];

export default function WorkNoteCreateFromText() {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [draftGenerated, setDraftGenerated] = useState(false);
  const [useAgent, setUseAgent] = useState(true);
  const createdWorkNoteIdRef = useRef<string | null>(null);

  const generateMutation = useGenerateDraftWithSimilar();
  const agent = useAgentDraft();
  const { toast } = useToast();

  const isGenerating = useAgent ? agent.isPending : generateMutation.isPending;

  const progress = useStepProgress({ steps: textSteps, isActive: generateMutation.isPending });

  const { state, actions, data } = useAIDraftForm({
    onWorkNoteCreated: (workNote) => {
      createdWorkNoteIdRef.current = workNote.id;
    },
    onSuccess: () => {
      const id = createdWorkNoteIdRef.current;
      if (id) {
        navigate(`/work-notes/${id}`, { replace: true });
      } else {
        navigate('/work-notes', { replace: true });
      }
    },
  });

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      toast({ variant: 'destructive', title: '오류', description: '텍스트를 입력해주세요.' });
      return;
    }

    const requestData = {
      inputText: inputText.trim(),
      personIds: selectedPersonIds.length > 0 ? selectedPersonIds : undefined,
    };

    if (useAgent) {
      const result = await agent.generate(requestData);
      if (result) {
        actions.populateDraft(result.draft, result.references, result.meetingReferences);
        setDraftGenerated(true);
      }
    } else {
      try {
        const result = await generateMutation.mutateAsync(requestData);
        actions.populateDraft(result.draft, result.references, result.meetingReferences);
        setDraftGenerated(true);
      } catch {
        // Error handled by mutation hook
      }
    }
  };

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              텍스트로 업무노트 만들기
            </h1>
            <p className="page-description">
              텍스트를 입력하면 AI가 유사한 업무노트를 참고하여 자동으로 초안을 생성합니다.
            </p>
          </div>
        </div>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>업무 내용 입력</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!draftGenerated && (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="input-text">업무 내용 입력</Label>
                  <Textarea
                    id="input-text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="업무에 대한 내용을 자유롭게 입력하세요. AI가 유사한 업무노트를 참고하여 구조화된 초안을 생성합니다."
                    className="min-h-[200px]"
                    disabled={isGenerating}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>담당자 (선택사항)</Label>
                  {data.persons.length === 0 && !data.personsLoading ? (
                    <p className="text-sm text-muted-foreground">
                      등록된 사람이 없습니다. 먼저 사람을 추가해주세요.
                    </p>
                  ) : (
                    <AssigneeSelector
                      persons={data.persons}
                      selectedPersonIds={selectedPersonIds}
                      onSelectionChange={setSelectedPersonIds}
                      isLoading={data.personsLoading}
                    />
                  )}
                </div>

                {isGenerating && useAgent && <AgentProgressDisplay events={agent.progress} />}
                {isGenerating && !useAgent && (
                  <StepProgressIndicator
                    steps={progress.steps}
                    currentStepIndex={progress.currentStepIndex}
                  />
                )}

                <div className="flex gap-2 justify-end items-center">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground mr-auto cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useAgent}
                      onChange={(e) => setUseAgent(e.target.checked)}
                      disabled={isGenerating}
                      className="rounded"
                    />
                    <Bot className="h-4 w-4" />
                    에이전트 모드
                  </label>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    취소
                  </Button>
                  <Button
                    onClick={() => void handleGenerate()}
                    disabled={isGenerating || !inputText.trim()}
                  >
                    {isGenerating ? (
                      <>처리 중...</>
                    ) : (
                      <>
                        {useAgent ? (
                          <Bot className="h-4 w-4 mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        {useAgent ? 'AI 에이전트로 생성' : 'AI로 초안 생성'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {draftGenerated && (
              <DraftEditorForm
                state={state}
                actions={actions}
                data={data}
                onCancel={handleCancel}
                onReset={() => setDraftGenerated(false)}
                resetLabel="다시 입력"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
