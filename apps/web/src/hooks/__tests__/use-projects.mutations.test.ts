import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createProject, createProjectFile, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useAssignWorkNoteToProject,
  useCreateProject,
  useDeleteProject,
  useDeleteProjectFile,
  useMigrateProjectFiles,
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
    migrateProjectFiles: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useCreateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('creates project successfully with success toast', async () => {
    const mockProject = createProject({ name: 'New Project' });
    vi.mocked(API.createProject).mockResolvedValue(mockProject);

    const { result } = renderHookWithClient(() => useCreateProject());

    await act(async () => {
      result.current.mutate({ name: 'New Project' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.createProject).toHaveBeenCalledWith({ name: 'New Project' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '프로젝트가 생성되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Create failed');
    vi.mocked(API.createProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useCreateProject());

    await act(async () => {
      result.current.mutate({ name: 'New Project' });
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

  it('invalidates projects query on success', async () => {
    const mockProject = createProject({ name: 'New Project' });
    vi.mocked(API.createProject).mockResolvedValue(mockProject);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useCreateProject(), { queryClient });

    await act(async () => {
      result.current.mutate({ name: 'New Project' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });
});

describe('useUpdateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('updates project successfully with success toast', async () => {
    const mockProject = createProject({ name: 'Updated Project' });
    vi.mocked(API.updateProject).mockResolvedValue(mockProject);

    const { result } = renderHookWithClient(() => useUpdateProject());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', data: { name: 'Updated Project' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateProject).toHaveBeenCalledWith('project-1', { name: 'Updated Project' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '프로젝트가 수정되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Update failed');
    vi.mocked(API.updateProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUpdateProject());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', data: { name: 'Updated' } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Update failed',
    });
  });

  it('invalidates projects and project queries on success', async () => {
    const mockProject = createProject({ name: 'Updated Project' });
    vi.mocked(API.updateProject).mockResolvedValue(mockProject);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdateProject(), { queryClient });

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', data: { name: 'Updated' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 'project-1'] });
  });
});

describe('useDeleteProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('deletes project successfully with success toast', async () => {
    vi.mocked(API.deleteProject).mockResolvedValue(undefined);

    const { result } = renderHookWithClient(() => useDeleteProject());

    await act(async () => {
      result.current.mutate('project-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.deleteProject).toHaveBeenCalledWith('project-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '프로젝트가 삭제되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Delete failed');
    vi.mocked(API.deleteProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useDeleteProject());

    await act(async () => {
      result.current.mutate('project-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Delete failed',
    });
  });

  it('invalidates projects query on success', async () => {
    vi.mocked(API.deleteProject).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useDeleteProject(), { queryClient });

    await act(async () => {
      result.current.mutate('project-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });
});

describe('useAssignWorkNoteToProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('assigns work note successfully with success toast', async () => {
    vi.mocked(API.assignWorkNoteToProject).mockResolvedValue(undefined);

    const { result } = renderHookWithClient(() => useAssignWorkNoteToProject());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', data: { workId: 'work-1' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.assignWorkNoteToProject).toHaveBeenCalledWith('project-1', { workId: 'work-1' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무노트가 프로젝트에 연결되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Assign failed');
    vi.mocked(API.assignWorkNoteToProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useAssignWorkNoteToProject());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', data: { workId: 'work-1' } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Assign failed',
    });
  });

  it('invalidates project and work notes queries on success', async () => {
    vi.mocked(API.assignWorkNoteToProject).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useAssignWorkNoteToProject(), { queryClient });

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', data: { workId: 'work-1' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 'project-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-work-notes', 'project-1'] });
  });
});

describe('useRemoveWorkNoteFromProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('removes work note successfully with success toast', async () => {
    vi.mocked(API.removeWorkNoteFromProject).mockResolvedValue(undefined);

    const { result } = renderHookWithClient(() => useRemoveWorkNoteFromProject());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', workId: 'work-1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.removeWorkNoteFromProject).toHaveBeenCalledWith('project-1', 'work-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무노트 연결이 해제되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Remove failed');
    vi.mocked(API.removeWorkNoteFromProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useRemoveWorkNoteFromProject());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', workId: 'work-1' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Remove failed',
    });
  });

  it('invalidates project and work notes queries on success', async () => {
    vi.mocked(API.removeWorkNoteFromProject).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useRemoveWorkNoteFromProject(), { queryClient });

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', workId: 'work-1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 'project-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-work-notes', 'project-1'] });
  });
});

describe('useUploadProjectFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('uploads file successfully with success toast', async () => {
    const mockFile = createProjectFile({ originalName: 'uploaded.pdf' });
    vi.mocked(API.uploadProjectFile).mockResolvedValue(mockFile);

    const { result } = renderHookWithClient(() => useUploadProjectFile());

    const file = new File(['test content'], 'uploaded.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', file });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.uploadProjectFile).toHaveBeenCalledWith('project-1', file);
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '파일이 업로드되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Upload failed');
    vi.mocked(API.uploadProjectFile).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUploadProjectFile());

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', file });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Upload failed',
    });
  });

  it('invalidates project files and project queries on success', async () => {
    const mockFile = createProjectFile();
    vi.mocked(API.uploadProjectFile).mockResolvedValue(mockFile);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUploadProjectFile(), { queryClient });

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', file });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-files', 'project-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 'project-1'] });
  });
});

describe('useDeleteProjectFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('deletes file successfully with success toast', async () => {
    vi.mocked(API.deleteProjectFile).mockResolvedValue(undefined);

    const { result } = renderHookWithClient(() => useDeleteProjectFile());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', fileId: 'file-1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.deleteProjectFile).toHaveBeenCalledWith('project-1', 'file-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '파일이 삭제되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Delete failed');
    vi.mocked(API.deleteProjectFile).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useDeleteProjectFile());

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', fileId: 'file-1' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Delete failed',
    });
  });

  it('invalidates project files and project queries on success', async () => {
    vi.mocked(API.deleteProjectFile).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useDeleteProjectFile(), { queryClient });

    await act(async () => {
      result.current.mutate({ projectId: 'project-1', fileId: 'file-1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-files', 'project-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 'project-1'] });
  });
});

describe('useMigrateProjectFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('invalidates project-files and project queries and shows summary toast', async () => {
    vi.mocked(API.migrateProjectFiles).mockResolvedValue({
      migrated: 3,
      skipped: 1,
      failed: 0,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHookWithClient(() => useMigrateProjectFiles(), { queryClient });

    await act(async () => {
      result.current.mutate('project-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-files', 'project-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 'project-1'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '마이그레이션 완료: 이동 3개 · 건너뜀 1개 · 실패 0개',
    });
  });
});
