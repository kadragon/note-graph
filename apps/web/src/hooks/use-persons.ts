// Trace: SPEC-person-1, SPEC-person-2, SPEC-person-3, TASK-022, TASK-025, TASK-027, TASK-LLM-IMPORT
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import type {
  CreatePersonRequest,
  ImportPersonFromTextRequest,
  UpdatePersonRequest,
} from '@web/types/api';
import { useToast } from './use-toast';

export function usePersons() {
  return useQuery({
    queryKey: ['persons'],
    queryFn: () => API.getPersons(),
  });
}

export const useCreatePerson = createStandardMutation({
  mutationFn: (data: CreatePersonRequest) => API.createPerson(data),
  invalidateKeys: [['persons'], ['departments']],
  messages: {
    success: '사람이 추가되었습니다.',
    error: '사람을 추가할 수 없습니다.',
  },
});

export const useUpdatePerson = createStandardMutation({
  mutationFn: ({ personId, data }: { personId: string; data: UpdatePersonRequest }) =>
    API.updatePerson(personId, data),
  invalidateKeys: [['persons'], ['departments']],
  messages: {
    success: '사람 정보가 수정되었습니다.',
    error: '사람 정보를 수정할 수 없습니다.',
  },
});

export function usePersonHistory(personId: string | null) {
  return useQuery({
    queryKey: ['person-history', personId],
    queryFn: () => API.getPersonHistory(personId as string),
    enabled: !!personId,
  });
}

// Keep manual - only has onError, no invalidation
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

// Keep manual - conditional success message based on result.isNew
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
