import { useMutation } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import type { SearchRequest, UnifiedSearchResult } from '@web/types/api';
import { useToast } from './use-toast';

export function useSearch() {
  const { toast } = useToast();

  return useMutation<UnifiedSearchResult, Error, SearchRequest>({
    mutationFn: (data: SearchRequest) => API.search(data),
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '검색에 실패했습니다.',
      });
    },
  });
}
