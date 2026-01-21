import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { resetFactoryCounter } from '@web/test/factories';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useAssignWorkNoteToProject,
  useCreateProject,
  useDeleteProject,
  useDeleteProjectFile,
  useRemoveWorkNoteFromProject,
  useUpdateProject,
  useUploadProjectFile,
} from '../use-projects';

vi.mock('@web/lib/api', () => ({
  API: {
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    assignWorkNoteToProject: vi.fn(),
    removeWorkNoteFromProject: vi.fn(),
    uploadProjectFile: vi.fn(),
    deleteProjectFile: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useProject error fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('useCreateProject shows fallback error message when error has no message', async () => {
    const error = new Error();
    error.message = '';
    vi.mocked(API.createProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useCreateProject());

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '프로젝트를 생성할 수 없습니다.',
    });
  });

  it('useUpdateProject shows fallback error message when error has no message', async () => {
    const error = new Error();
    error.message = '';
    vi.mocked(API.updateProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUpdateProject());

    await act(async () => {
      result.current.mutate({ projectId: 'p1', data: { name: 'Test' } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '프로젝트를 수정할 수 없습니다.',
    });
  });

  it('useDeleteProject shows fallback error message when error has no message', async () => {
    const error = new Error();
    error.message = '';
    vi.mocked(API.deleteProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useDeleteProject());

    await act(async () => {
      result.current.mutate('p1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '프로젝트를 삭제할 수 없습니다.',
    });
  });

  it('useAssignWorkNoteToProject shows fallback error message when error has no message', async () => {
    const error = new Error();
    error.message = '';
    vi.mocked(API.assignWorkNoteToProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useAssignWorkNoteToProject());

    await act(async () => {
      result.current.mutate({ projectId: 'p1', data: { workId: 'w1' } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '업무노트를 연결할 수 없습니다.',
    });
  });

  it('useRemoveWorkNoteFromProject shows fallback error message when error has no message', async () => {
    const error = new Error();
    error.message = '';
    vi.mocked(API.removeWorkNoteFromProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useRemoveWorkNoteFromProject());

    await act(async () => {
      result.current.mutate({ projectId: 'p1', workId: 'w1' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '업무노트 연결을 해제할 수 없습니다.',
    });
  });

  it('useUploadProjectFile shows fallback error message when error has no message', async () => {
    const error = new Error();
    error.message = '';
    vi.mocked(API.uploadProjectFile).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUploadProjectFile());

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({ projectId: 'p1', file });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '파일을 업로드할 수 없습니다.',
    });
  });

  it('useDeleteProjectFile shows fallback error message when error has no message', async () => {
    const error = new Error();
    error.message = '';
    vi.mocked(API.deleteProjectFile).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useDeleteProjectFile());

    await act(async () => {
      result.current.mutate({ projectId: 'p1', fileId: 'f1' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '파일을 삭제할 수 없습니다.',
    });
  });
});
