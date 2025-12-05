// Trace: TASK-027, SPEC-worknote-1
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api';
import type { AIGenerateDraftRequest } from '@/types/api';

export function useGenerateDraftWithSimilar() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: AIGenerateDraftRequest) => API.generateDraftWithSimilar(data),
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || 'AI 초안 생성에 실패했습니다.',
      });
    },
  });
}
