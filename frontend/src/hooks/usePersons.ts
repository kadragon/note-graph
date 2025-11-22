// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-022, TASK-025, TASK-027, TASK-LLM-IMPORT
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import type { CreatePersonRequest, UpdatePersonRequest, ImportPersonFromTextRequest } from '@/types/api';

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
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
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
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
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

export function useParsePersonFromText() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: ImportPersonFromTextRequest) => API.parsePersonFromText(data),
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '텍스트 파싱에 실패했습니다.',
      });
    },
  });
}

export function useImportPerson() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreatePersonRequest) => API.importPerson(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
      void queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: '성공',
        description: result.isNew ? '새 사람이 추가되었습니다.' : '사람 정보가 업데이트되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '사람을 가져올 수 없습니다.',
      });
    },
  });
}
