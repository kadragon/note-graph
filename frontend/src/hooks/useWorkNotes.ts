import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TODO_STATUS } from '@/constants/todoStatus';
import { API } from '@/lib/api';
import type { CreateWorkNoteRequest, UpdateWorkNoteRequest, WorkNoteWithStats } from '@/types/api';
import { useToast } from './use-toast';

export function useWorkNotes() {
  return useQuery({
    queryKey: ['work-notes'],
    queryFn: () => API.getWorkNotes(),
  });
}

export function useWorkNotesWithStats() {
  return useQuery({
    queryKey: ['work-notes-with-stats'],
    queryFn: async () => {
      const workNotes = await API.getWorkNotes();

      // Fetch todos for all work notes in parallel
      const now = new Date();
      const workNotesWithStats = await Promise.all(
        workNotes.map(async (workNote) => {
          try {
            const todos = await API.getWorkNoteTodos(workNote.id);
            const total = todos.length;
            // 한 번의 순회로 모든 통계 계산
            // Calculate tomorrow midnight for consistent wait_until comparison
            const tomorrowMidnight = new Date(now);
            tomorrowMidnight.setHours(0, 0, 0, 0);
            tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);

            const { completed, pending, remaining } = todos.reduce(
              (acc, todo) => {
                if (todo.status === TODO_STATUS.COMPLETED) {
                  acc.completed++;
                } else {
                  // 미완료 상태: waitUntil이 내일 이후면 pending, 아니면 remaining
                  // 백엔드와 동일한 로직: waitUntil < tomorrowMidnight이면 remaining
                  const hasFutureWaitUntil =
                    todo.waitUntil && new Date(todo.waitUntil) >= tomorrowMidnight;
                  if (hasFutureWaitUntil) {
                    acc.pending++;
                  } else {
                    acc.remaining++;
                  }
                }
                return acc;
              },
              { completed: 0, pending: 0, remaining: 0 }
            );

            return {
              ...workNote,
              todoStats: { total, completed, remaining, pending },
            } as WorkNoteWithStats;
          } catch (error) {
            // Log error for debugging
            console.error(`Failed to fetch todos for work note ${workNote.id}:`, error);

            // If there's an error fetching todos, return with zero stats
            return {
              ...workNote,
              todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 },
            } as WorkNoteWithStats;
          }
        })
      );

      return workNotesWithStats;
    },
  });
}

export function useCreateWorkNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateWorkNoteRequest) => API.createWorkNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      toast({
        title: '성공',
        description: '업무노트가 생성되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트를 생성할 수 없습니다.',
      });
    },
  });
}

export function useUpdateWorkNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ workId, data }: { workId: string; data: UpdateWorkNoteRequest }) =>
      API.updateWorkNote(workId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['work-note-detail', variables.workId] });
      toast({
        title: '성공',
        description: '업무노트가 수정되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트를 수정할 수 없습니다.',
      });
    },
  });
}

export function useDeleteWorkNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (workId: string) => API.deleteWorkNote(workId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
      toast({
        title: '성공',
        description: '업무노트가 삭제되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무노트를 삭제할 수 없습니다.',
      });
    },
  });
}
