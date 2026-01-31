import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import { useToast } from './use-toast';

// Trace: spec_id=SPEC-pdf-1, task_id=TASK-062

export const useUploadPDF = createStandardMutation({
  mutationFn: (file: File) => API.uploadPDF(file),
  invalidateKeys: [],
  messages: {
    success: 'PDF 파일이 업로드되었습니다.',
    error: 'PDF 업로드에 실패했습니다.',
  },
});

export function usePDFJob(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['pdf-job', jobId],
    queryFn: () => API.getPDFJob(jobId as string),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 2000 : false;
    },
  });
}

interface SavePDFDraftParams {
  draft: { title: string; category: string; content: string };
  pdfFile?: File;
}

// Keep manual - complex mutationFn with nested API calls and conditional toast
export function useSavePDFDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ draft, pdfFile }: SavePDFDraftParams) => {
      // 1. Create work note first
      const workNote = await API.createWorkNote(draft);

      // 2. Auto-attach PDF if provided
      if (pdfFile && workNote.id) {
        try {
          await API.uploadWorkNoteFile(workNote.id, pdfFile);
        } catch (error) {
          console.error('Failed to attach PDF:', error);
          // Work note created successfully, but attachment failed
          toast({
            variant: 'destructive',
            title: '주의',
            description: 'PDF 첨부에 실패했습니다. 업무노트는 생성되었습니다.',
          });
        }
      }

      return workNote;
    },
    onSuccess: (workNote) => {
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      if (workNote?.id) {
        void queryClient.invalidateQueries({ queryKey: ['work-note-detail', workNote.id] });
        void queryClient.invalidateQueries({ queryKey: ['work-note-files', workNote.id] });
      }
      toast({
        title: '성공',
        description: '업무노트로 저장되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트 생성에 실패했습니다.',
      });
    },
  });
}
