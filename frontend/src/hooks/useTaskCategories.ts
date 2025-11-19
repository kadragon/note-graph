import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import type { CreateTaskCategoryRequest, UpdateTaskCategoryRequest } from '@/types/api';

export function useTaskCategories() {
  return useQuery({
    queryKey: ['taskCategories'],
    queryFn: () => API.getTaskCategories(),
  });
}

export function useCreateTaskCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateTaskCategoryRequest) => API.createTaskCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskCategories'] });
      toast({
        title: '성공',
        description: '업무 구분이 생성되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무 구분을 생성할 수 없습니다.',
      });
    },
  });
}

export function useUpdateTaskCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateTaskCategoryRequest }) =>
      API.updateTaskCategory(categoryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskCategories'] });
      toast({
        title: '성공',
        description: '업무 구분이 수정되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무 구분을 수정할 수 없습니다.',
      });
    },
  });
}

export function useDeleteTaskCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (categoryId: string) => API.deleteTaskCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskCategories'] });
      toast({
        title: '성공',
        description: '업무 구분이 삭제되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '업무 구분을 삭제할 수 없습니다.',
      });
    },
  });
}
