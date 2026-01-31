import { useQuery } from '@tanstack/react-query';
import { DEPARTMENT_SEARCH_LIMIT } from '@web/constants/search';
import { API } from '@web/lib/api';
import { createStandardMutation } from '@web/lib/hooks/create-standard-mutation';
import type { CreateDepartmentRequest, Department, UpdateDepartmentRequest } from '@web/types/api';

interface UseDepartmentsOptions {
  search?: string;
  limit?: number;
  enabled?: boolean;
}

export function useDepartments(options?: UseDepartmentsOptions) {
  const { search, limit = DEPARTMENT_SEARCH_LIMIT, enabled = true } = options ?? {};

  return useQuery<Department[]>({
    queryKey: ['departments', search ?? '', limit],
    queryFn: ({ signal }) => API.getDepartments({ q: search, limit }, signal),
    enabled,
    staleTime: 30_000,
  });
}

export const useCreateDepartment = createStandardMutation({
  mutationFn: (data: CreateDepartmentRequest) => API.createDepartment(data),
  invalidateKeys: [['departments']],
  messages: {
    success: '부서가 생성되었습니다.',
    error: '부서를 생성할 수 없습니다.',
  },
});

export const useUpdateDepartment = createStandardMutation({
  mutationFn: ({ deptName, data }: { deptName: string; data: UpdateDepartmentRequest }) =>
    API.updateDepartment(deptName, data),
  invalidateKeys: [['departments']],
  messages: {
    success: '부서가 수정되었습니다.',
    error: '부서를 수정할 수 없습니다.',
  },
});
