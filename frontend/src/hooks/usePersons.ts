// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-022, TASK-025, TASK-027
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import type { CreatePersonRequest, UpdatePersonRequest } from '@/types/api';

export function usePersons() {
  return useQuery({
    queryKey: ['persons'],
    queryFn: () => API.getPersons(),
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreatePersonRequest) => API.createPerson(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      toast({
        title: '성공',
        description: '사람이 추가되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '사람을 추가할 수 없습니다.',
      });
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: UpdatePersonRequest }) =>
      API.updatePerson(personId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      toast({
        title: '성공',
        description: '사람 정보가 수정되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '사람 정보를 수정할 수 없습니다.',
      });
    },
  });
}

export function usePersonHistory(personId: string | null) {
  return useQuery({
    queryKey: ['person-history', personId],
    queryFn: () => API.getPersonHistory(personId!),
    enabled: !!personId,
  });
}
