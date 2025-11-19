import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import { useCreateWorkNote } from './useWorkNotes';

export function useUploadPDF() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (file: File) => API.uploadPDF(file),
    onSuccess: (data) => {
      toast({
        title: '성공',
        description: 'PDF 파일이 업로드되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || 'PDF 업로드에 실패했습니다.',
      });
    },
  });
}

export function usePDFJob(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['pdf-job', jobId],
    queryFn: () => API.getPDFJob(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 2000 : false;
    },
  });
}

export function useSavePDFDraft() {
  const createWorkNote = useCreateWorkNote();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (draft: {
      title: string;
      category: string;
      content: string;
    }) => {
      return createWorkNote.mutateAsync(draft);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      toast({
        title: '성공',
        description: '업무노트로 저장되었습니다.',
      });
    },
  });
}
