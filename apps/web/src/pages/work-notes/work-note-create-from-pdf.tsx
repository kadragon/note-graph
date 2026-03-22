import { AgentProgressDisplay } from '@web/components/agent-progress-display';
import { DraftEditorForm } from '@web/components/draft-editor-form';
import { StepProgressIndicator } from '@web/components/step-progress-indicator';
import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { useAgentDraft } from '@web/hooks/use-agent-draft';
import { useAIDraftForm } from '@web/hooks/use-ai-draft-form';
import { usePDFJob, useUploadPDF } from '@web/hooks/use-pdf';
import type { ProgressStep } from '@web/hooks/use-step-progress';
import { useStepProgress } from '@web/hooks/use-step-progress';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import { autoAttachPdf } from '@web/lib/auto-attach-pdf';
import { FileDropzone } from '@web/pages/pdf-upload/components/file-dropzone';
import { ArrowLeft, Bot, FileText } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const pdfSteps: ProgressStep[] = [
  { label: 'PDF 텍스트 추출 중...', durationMs: 2000 },
  { label: '유사 업무노트 검색 중...', durationMs: 3000 },
  { label: 'AI 초안 생성 중...', durationMs: 0 },
];

export default function WorkNoteCreateFromPDF() {
  const navigate = useNavigate();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [draftPopulated, setDraftPopulated] = useState(false);
  const [useAgent, setUseAgent] = useState(true);
  const createdWorkNoteIdRef = useRef<string | null>(null);

  const uploadMutation = useUploadPDF();
  const { data: job } = usePDFJob(
    currentJobId,
    !!currentJobId && uploadMutation.isSuccess && !useAgent
  );
  const agent = useAgentDraft();
  const { toast } = useToast();

  const isProcessing = useAgent
    ? agent.isPending
    : !!currentJobId && (job?.status === 'PENDING' || job?.status === 'PROCESSING');
  const progress = useStepProgress({ steps: pdfSteps, isActive: isProcessing && !useAgent });

  const { state, actions, data } = useAIDraftForm({
    onWorkNoteCreated: async (workNote) => {
      createdWorkNoteIdRef.current = workNote.id;
      await autoAttachPdf({
        workNoteId: workNote.id,
        pdfFile: uploadedFile,
        uploadWorkNoteFile: API.uploadWorkNoteFile.bind(API),
      });
    },
    onWorkNoteCreatedError: (error) => {
      console.error('Failed to attach PDF:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: 'PDF 첨부에 실패했습니다. 업무노트는 생성되었습니다.',
      });
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

  // Update form when draft is ready (non-agent mode, only once)
  useEffect(() => {
    if (!useAgent && job?.status === 'READY' && job.draft && !draftPopulated) {
      actions.populateDraft(job.draft, job.references);
      setDraftPopulated(true);
    }
  }, [useAgent, job, draftPopulated, actions]);

  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '파일 크기는 10MB를 초과할 수 없습니다.',
      });
      return;
    }
    setUploadedFile(file);

    if (useAgent) {
      const result = await agent.generateFromPDF(file);
      if (result) {
        actions.populateDraft(result.draft, result.references, result.meetingReferences);
        setDraftPopulated(true);
      }
    } else {
      try {
        const result = await uploadMutation.mutateAsync(file);
        setCurrentJobId(result.jobId);
      } catch {
        // Error handled by mutation hook
      }
    }
  };

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const hasDraft = useAgent ? draftPopulated : job?.status === 'READY' && !!job.draft;

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
              <FileText className="h-5 w-5" />
              PDF로 업무노트 만들기
            </h1>
            <p className="page-description">
              PDF 파일을 업로드하면 AI가 자동으로 업무노트 초안을 생성합니다.
            </p>
          </div>
        </div>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>PDF 업로드</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!hasDraft && (
              <div className="space-y-3">
                <FileDropzone
                  onFileSelect={(file) => void handleFileSelect(file)}
                  disabled={useAgent ? agent.isPending : !!currentJobId}
                />

                {uploadedFile && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      {!useAgent && job?.status === 'ERROR' ? (
                        <Badge variant="destructive">실패</Badge>
                      ) : null}
                    </div>
                    {isProcessing && useAgent && <AgentProgressDisplay events={agent.progress} />}
                    {isProcessing && !useAgent && (
                      <StepProgressIndicator
                        steps={progress.steps}
                        currentStepIndex={progress.currentStepIndex}
                      />
                    )}
                    {!useAgent && job?.errorMessage && (
                      <p className="text-sm text-destructive mt-2">{job.errorMessage}</p>
                    )}
                  </Card>
                )}

                <div className="flex gap-2 justify-end items-center">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground mr-auto cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useAgent}
                      onChange={(e) => setUseAgent(e.target.checked)}
                      disabled={useAgent ? agent.isPending : !!currentJobId}
                      className="rounded"
                    />
                    <Bot className="h-4 w-4" />
                    에이전트 모드
                  </label>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    취소
                  </Button>
                </div>
              </div>
            )}

            {hasDraft && (
              <DraftEditorForm
                state={state}
                actions={actions}
                data={data}
                onCancel={handleCancel}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
