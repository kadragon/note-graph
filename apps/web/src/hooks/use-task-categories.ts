import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import type { CreateTaskCategoryRequest, UpdateTaskCategoryRequest } from '@web/types/api';
import { useToast } from './use-toast';

export function useTaskCategories(activeOnly = false) {
  return useQuery({
    queryKey: ['taskCategories', { activeOnly }],
    queryFn: () => API.getTaskCategories(activeOnly),
  });
}

export const useCreateTaskCategory = createStandardMutation({
  mutationFn: (data: CreateTaskCategoryRequest) => API.createTaskCategory(data),
  invalidateKeys: [['taskCategories']],
  messages: {
    success: '업무 구분이 생성되었습니다.',
    error: '업무 구분을 생성할 수 없습니다.',
  },
});

export const useUpdateTaskCategory = createStandardMutation({
  mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateTaskCategoryRequest }) =>
    API.updateTaskCategory(categoryId, data),
  invalidateKeys: [['taskCategories']],
  messages: {
    success: '업무 구분이 수정되었습니다.',
    error: '업무 구분을 수정할 수 없습니다.',
  },
});

export const useDeleteTaskCategory = createStandardMutation({
  mutationFn: (categoryId: string) => API.deleteTaskCategory(categoryId),
  invalidateKeys: [['taskCategories']],
  messages: {
    success: '업무 구분이 삭제되었습니다.',
    error: '업무 구분을 삭제할 수 없습니다.',
  },
});

// Keep manual implementation - conditional success message based on isActive
export function useToggleTaskCategoryActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) =>
      API.toggleTaskCategoryActive(categoryId, isActive),
    onSuccess: (_, { isActive }) => {
      void queryClient.invalidateQueries({ queryKey: ['taskCategories'] });
      toast({
        title: '성공',
        description: isActive ? '업무 구분이 활성화되었습니다.' : '업무 구분이 비활성화되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무 구분 상태를 변경할 수 없습니다.',
      });
    },
  });
}
