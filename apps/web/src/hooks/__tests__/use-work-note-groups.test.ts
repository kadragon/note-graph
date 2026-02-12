import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createWorkNoteGroup, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreateWorkNoteGroup,
  useDeleteWorkNoteGroup,
  useToggleWorkNoteGroupActive,
  useUpdateWorkNoteGroup,
  useWorkNoteGroups,
} from '../use-work-note-groups';

vi.mock('@web/lib/api', () => ({
  API: {
    getWorkNoteGroups: vi.fn(),
    createWorkNoteGroup: vi.fn(),
    updateWorkNoteGroup: vi.fn(),
    deleteWorkNoteGroup: vi.fn(),
    toggleWorkNoteGroupActive: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useWorkNoteGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches work note groups', async () => {
    const groups = [createWorkNoteGroup({ name: '프로젝트 A' })];
    vi.mocked(API.getWorkNoteGroups).mockResolvedValue(groups);

    const { result } = renderHookWithClient(() => useWorkNoteGroups());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getWorkNoteGroups).toHaveBeenCalledWith(false);
    expect(result.current.data).toEqual(groups);
  });

  it('creates a work note group and invalidates queries', async () => {
    const group = createWorkNoteGroup({ name: '신규 그룹' });
    vi.mocked(API.createWorkNoteGroup).mockResolvedValue(group);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useCreateWorkNoteGroup(), { queryClient });

    await act(async () => {
      result.current.mutate({ name: '신규 그룹' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.createWorkNoteGroup).toHaveBeenCalledWith({ name: '신규 그룹' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workNoteGroups'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무 그룹이 생성되었습니다.',
    });
  });

  it('updates a work note group and invalidates queries', async () => {
    const group = createWorkNoteGroup({ groupId: 'grp-1', name: '수정됨' });
    vi.mocked(API.updateWorkNoteGroup).mockResolvedValue(group);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdateWorkNoteGroup(), { queryClient });

    await act(async () => {
      result.current.mutate({ groupId: 'grp-1', data: { name: '수정됨' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateWorkNoteGroup).toHaveBeenCalledWith('grp-1', { name: '수정됨' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workNoteGroups'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무 그룹이 수정되었습니다.',
    });
  });

  it('deletes a work note group and invalidates queries', async () => {
    vi.mocked(API.deleteWorkNoteGroup).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useDeleteWorkNoteGroup(), { queryClient });

    await act(async () => {
      result.current.mutate('grp-2');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.deleteWorkNoteGroup).toHaveBeenCalledWith('grp-2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workNoteGroups'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무 그룹이 삭제되었습니다.',
    });
  });

  it('toggles work note group active status', async () => {
    const group = createWorkNoteGroup({ groupId: 'grp-1', isActive: false });
    vi.mocked(API.toggleWorkNoteGroupActive).mockResolvedValue(group);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useToggleWorkNoteGroupActive(), {
      queryClient,
    });

    await act(async () => {
      result.current.mutate({ groupId: 'grp-1', isActive: false });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.toggleWorkNoteGroupActive).toHaveBeenCalledWith('grp-1', false);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workNoteGroups'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무 그룹이 비활성화되었습니다.',
    });
  });

  it('shows an error toast when creation fails', async () => {
    vi.mocked(API.createWorkNoteGroup).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHookWithClient(() => useCreateWorkNoteGroup());

    await act(async () => {
      result.current.mutate({ name: '실패' });
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
