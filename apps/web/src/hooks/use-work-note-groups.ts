import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import type { CreateWorkNoteGroupRequest, UpdateWorkNoteGroupRequest } from '@web/types/api';
import { useToast } from './use-toast';

export function useWorkNoteGroups(activeOnly = false) {
  return useQuery({
    queryKey: ['workNoteGroups', { activeOnly }],
    queryFn: () => API.getWorkNoteGroups(activeOnly),
  });
}

export const useCreateWorkNoteGroup = createStandardMutation({
  mutationFn: (data: CreateWorkNoteGroupRequest) => API.createWorkNoteGroup(data),
  invalidateKeys: [['workNoteGroups']],
  messages: {
    success: '업무 그룹이 생성되었습니다.',
    error: '업무 그룹을 생성할 수 없습니다.',
  },
});

export const useUpdateWorkNoteGroup = createStandardMutation({
  mutationFn: ({ groupId, data }: { groupId: string; data: UpdateWorkNoteGroupRequest }) =>
    API.updateWorkNoteGroup(groupId, data),
  invalidateKeys: [['workNoteGroups']],
  messages: {
    success: '업무 그룹이 수정되었습니다.',
    error: '업무 그룹을 수정할 수 없습니다.',
  },
});

export const useDeleteWorkNoteGroup = createStandardMutation({
  mutationFn: (groupId: string) => API.deleteWorkNoteGroup(groupId),
  invalidateKeys: [['workNoteGroups']],
  messages: {
    success: '업무 그룹이 삭제되었습니다.',
    error: '업무 그룹을 삭제할 수 없습니다.',
  },
});

// Keep manual implementation - conditional success message based on isActive
export function useToggleWorkNoteGroupActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ groupId }: { groupId: string; isActive: boolean }) =>
      API.toggleWorkNoteGroupActive(groupId),
    onSuccess: (_, { isActive }) => {
      void queryClient.invalidateQueries({ queryKey: ['workNoteGroups'] });
      toast({
        title: '성공',
        description: isActive ? '업무 그룹이 활성화되었습니다.' : '업무 그룹이 비활성화되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무 그룹 상태를 변경할 수 없습니다.',
      });
    },
  });
}
