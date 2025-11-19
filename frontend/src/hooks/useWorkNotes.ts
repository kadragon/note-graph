import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import type { CreateWorkNoteRequest, UpdateWorkNoteRequest } from '@/types/api';

export function useWorkNotes() {
  return useQuery({
    queryKey: ['work-notes'],
    queryFn: () => API.getWorkNotes(),
  });
}

export function useCreateWorkNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateWorkNoteRequest) => API.createWorkNote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-notes'] });
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
