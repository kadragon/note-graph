import { DraftEditorForm } from '@web/components/draft-editor-form';
import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { useAIDraftForm } from '@web/hooks/use-ai-draft-form';
import { usePDFJob, useUploadPDF } from '@web/hooks/use-pdf';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import { autoAttachPdf } from '@web/lib/auto-attach-pdf';
import { FileDropzone } from '@web/pages/pdf-upload/components/file-dropzone';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WorkNoteCreateFromPDF() {
  const navigate = useNavigate();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [draftPopulated, setDraftPopulated] = useState(false);
  const createdWorkNoteIdRef = useRef<string | null>(null);

  const uploadMutation = useUploadPDF();
  const { data: job } = usePDFJob(currentJobId, !!currentJobId && uploadMutation.isSuccess);
  const { toast } = useToast();

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

  // Update form when draft is ready (only once)
  useEffect(() => {
    if (job?.status === 'READY' && job.draft && !draftPopulated) {
      actions.populateDraft(job.draft, job.references);
      setDraftPopulated(true);
    }
  }, [job, draftPopulated, actions]);

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
    try {
      const result = await uploadMutation.mutateAsync(file);
      setCurrentJobId(result.jobId);
    } catch {
      // Error handled by mutation hook
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
            {!job?.draft && (
              <div className="space-y-3">
                <FileDropzone
                  onFileSelect={(file) => void handleFileSelect(file)}
                  disabled={uploadMutation.isPending || !!currentJobId}
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
                      {job?.status === 'PENDING' || job?.status === 'PROCESSING' ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          처리 중
                        </Badge>
                      ) : job?.status === 'ERROR' ? (
                        <Badge variant="destructive">실패</Badge>
                      ) : null}
                    </div>
                    {job?.errorMessage && (
                      <p className="text-sm text-destructive mt-2">{job.errorMessage}</p>
                    )}
                  </Card>
                )}

                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    취소
                  </Button>
                </div>
              </div>
            )}

            {job?.status === 'READY' && job.draft && (
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
