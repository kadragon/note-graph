import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/lib/api';
import { useToast } from './use-toast';
import type { CreateDepartmentRequest } from '@/types/api';

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => API.getDepartments(),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateDepartmentRequest) => API.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: '성공',
        description: '부서가 생성되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '부서를 생성할 수 없습니다.',
      });
    },
  });
}
