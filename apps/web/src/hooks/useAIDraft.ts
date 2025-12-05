// Trace: TASK-027, SPEC-worknote-1
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import type { AIGenerateDraftRequest } from '@web/types/api';

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
