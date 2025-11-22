import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import { TODO_STATUS } from '@/constants/todoStatus';
import type { CreateWorkNoteRequest, UpdateWorkNoteRequest, WorkNoteWithStats } from '@/types/api';

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
            const completed = todos.filter(todo => todo.status === TODO_STATUS.COMPLETED).length;
            // Pending: 완료되지 않은 할일 중 waitUntil이 미래인 것
            const pending = todos.filter(todo => {
              if (todo.status === TODO_STATUS.COMPLETED) return false;
              if (!todo.waitUntil) return false;
              return new Date(todo.waitUntil) > now;
            }).length;
            // Remaining: 완료되지 않았고, waitUntil이 없거나 현재 이전인 할일 (지금 할 수 있는 것)
            const remaining = todos.filter(todo => {
              if (todo.status === TODO_STATUS.COMPLETED) return false;
              if (todo.waitUntil && new Date(todo.waitUntil) > now) return false;
              return true;
            }).length;

            return {
              ...workNote,
              todoStats: { total, completed, remaining, pending }
            } as WorkNoteWithStats;
          } catch (error) {
            // Log error for debugging
            console.error(`Failed to fetch todos for work note ${workNote.id}:`, error);

            // If there's an error fetching todos, return with zero stats
            return {
              ...workNote,
              todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 }
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
      queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
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
      queryClient.invalidateQueries({ queryKey: ['work-notes'] });
      queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
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
