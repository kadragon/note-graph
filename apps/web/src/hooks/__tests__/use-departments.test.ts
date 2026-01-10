import { act, waitFor } from '@testing-library/react';
import { DEPARTMENT_SEARCH_LIMIT } from '@web/constants/search';
import { API } from '@web/lib/api';
import { createDepartment, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateDepartment, useDepartments, useUpdateDepartment } from '../use-departments';

vi.mock('@web/lib/api', () => ({
  API: {
    getDepartments: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useDepartments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches departments with default options', async () => {
    const departments = [createDepartment({ deptName: '개발' })];
    vi.mocked(API.getDepartments).mockResolvedValue(departments);

    const { result } = renderHookWithClient(() => useDepartments());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getDepartments).toHaveBeenCalledWith(
      { q: undefined, limit: DEPARTMENT_SEARCH_LIMIT },
      expect.any(AbortSignal)
    );
    expect(result.current.data).toEqual(departments);
  });

  it('fetches departments with search and custom limit', async () => {
    const departments = [createDepartment({ deptName: '디자인' })];
    vi.mocked(API.getDepartments).mockResolvedValue(departments);

    const { result } = renderHookWithClient(() => useDepartments({ search: '디자', limit: 3 }));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getDepartments).toHaveBeenCalledWith(
      { q: '디자', limit: 3 },
      expect.any(AbortSignal)
    );
    expect(result.current.data).toEqual(departments);
  });

  it('does not fetch when disabled', async () => {
    renderHookWithClient(() => useDepartments({ enabled: false }));

    await waitFor(() => {
      expect(API.getDepartments).not.toHaveBeenCalled();
    });
  });

  it('creates a department and invalidates queries', async () => {
    const department = createDepartment({ deptName: '인사' });
    vi.mocked(API.createDepartment).mockResolvedValue(department);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useCreateDepartment(), { queryClient });

    await act(async () => {
      result.current.mutate({ deptName: '인사' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.createDepartment).toHaveBeenCalledWith({ deptName: '인사' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['departments'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '부서가 생성되었습니다.',
    });
  });

  it('updates a department and invalidates queries', async () => {
    const department = createDepartment({ deptName: '개발', description: '업데이트' });
    vi.mocked(API.updateDepartment).mockResolvedValue(department);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdateDepartment(), { queryClient });

    await act(async () => {
      result.current.mutate({
        deptName: '개발',
        data: { description: '업데이트', isActive: true },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateDepartment).toHaveBeenCalledWith('개발', {
      description: '업데이트',
      isActive: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['departments'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '부서가 수정되었습니다.',
    });
  });

  it('shows an error toast when creation fails', async () => {
    vi.mocked(API.createDepartment).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHookWithClient(() => useCreateDepartment());

    await act(async () => {
      result.current.mutate({ deptName: '실패' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Create failed',
    });
  });
});
