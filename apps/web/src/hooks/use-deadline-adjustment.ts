import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { invalidateMany, workNoteRelatedKeys } from '@web/lib/query-invalidation';
import type { DeadlineSuggestion } from '@web/types/api';
import { useToast } from './use-toast';

export function useSuggestDeadlineAdjustments() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (
      todos: Array<{
        todoId: string;
        title: string;
        description?: string | null;
        dueDate: string;
        workTitle?: string;
        workCategory?: string | null;
      }>
    ) => API.suggestDeadlineAdjustments(todos),
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || 'AI 분석에 실패했습니다.',
      });
    },
  });
}

export function useBatchSetDueDates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (updates: Array<{ todoId: string; dueDate: string }>) =>
      API.batchSetDueDates(updates),
    onSuccess: (data) => {
      invalidateMany(
        queryClient,
        workNoteRelatedKeys(undefined, {
          includeTodos: true,
          includeWorkNotes: false,
          includeWorkNotesWithStats: true,
        })
      );
      toast({
        title: '성공',
        description: `${data.updatedCount}개 할일의 마감일이 조정되었습니다.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '마감일 조정에 실패했습니다.',
      });
    },
  });
}

export type { DeadlineSuggestion };
