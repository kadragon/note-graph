// Trace: SPEC-ai-draft-refs-1, SPEC-worknote-1, TASK-027, TASK-030, TASK-032

import { DraftEditorForm } from '@web/components/draft-editor-form';
import { Badge } from '@web/components/ui/badge';
import { Card } from '@web/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { useAIDraftForm } from '@web/hooks/use-ai-draft-form';
import { usePDFJob, useUploadPDF } from '@web/hooks/use-pdf';
import { useToast } from '@web/hooks/use-toast';
import { FileDropzone } from '@web/pages/pdf-upload/components/file-dropzone';
import { FileText, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface CreateFromPDFDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFromPDFDialog({ open, onOpenChange }: CreateFromPDFDialogProps) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [draftPopulated, setDraftPopulated] = useState(false);

  const uploadMutation = useUploadPDF();
  const { data: job } = usePDFJob(currentJobId, !!currentJobId && uploadMutation.isSuccess);
  const { toast } = useToast();

  const { state, actions, data } = useAIDraftForm(() => {
    onOpenChange(false);
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

  const resetForm = useCallback(() => {
    setCurrentJobId(null);
    setUploadedFile(null);
    setDraftPopulated(false);
    actions.resetForm();
  }, [actions]);

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        resetForm();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF로 업무노트 만들기
          </DialogTitle>
          <DialogDescription>
            PDF 파일을 업로드하면 AI가 자동으로 업무노트 초안을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Upload PDF */}
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
            </div>
          )}

          {/* Step 2: Edit Draft */}
          {job?.status === 'READY' && job.draft && (
            <DraftEditorForm state={state} actions={actions} data={data} onCancel={handleClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
