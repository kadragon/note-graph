import { useMutation } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import type { RAGQueryRequest } from '@/types/api';

export function useRAGQuery() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: RAGQueryRequest) => API.ragQuery(data),
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || 'AI 챗봇 질의에 실패했습니다.',
      });
    },
  });
}
