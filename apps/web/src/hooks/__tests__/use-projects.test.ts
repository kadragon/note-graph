import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import {
  createProject,
  createProjectDetail,
  createProjectFile,
  createProjectStats,
  createTodo,
  createWorkNote,
  resetFactoryCounter,
} from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import type { ProjectFile, Todo, WorkNote } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useAssignWorkNoteToProject,
  useCreateProject,
  useDeleteProject,
  useDeleteProjectFile,
  useProject,
  useProjectFiles,
  useProjectStats,
  useProjects,
  useProjectTodos,
  useProjectWorkNotes,
  useRemoveWorkNoteFromProject,
  useUpdateProject,
  useUploadProjectFile,
} from '../use-projects';

// Mock API with all project methods
vi.mock('@web/lib/api', () => ({
  API: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    getProjectStats: vi.fn(),
    getProjectTodos: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getProjectWorkNotes: vi.fn(),
    assignWorkNoteToProject: vi.fn(),
    removeWorkNoteFromProject: vi.fn(),
    getProjectFiles: vi.fn(),
    uploadProjectFile: vi.fn(),
    deleteProjectFile: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches projects successfully without filters', async () => {
    const mockProjects = [
      createProject({ name: 'Project 1' }),
      createProject({ name: 'Project 2' }),
    ];
    vi.mocked(API.getProjects).mockResolvedValue(mockProjects);

    const { result } = renderHookWithClient(() => useProjects());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getProjects).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(mockProjects);
  });

  it('fetches projects with filters', async () => {
    const mockProjects = [createProject({ name: 'In Progress Project', status: '진행중' })];
    vi.mocked(API.getProjects).mockResolvedValue(mockProjects);

    const filters = { status: '진행중' as const };
    const { result } = renderHookWithClient(() => useProjects(filters));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getProjects).toHaveBeenCalledWith(filters);
    expect(result.current.data).toEqual(mockProjects);
  });

  it('returns loading state initially', () => {
    vi.mocked(API.getProjects).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHookWithClient(() => useProjects());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Network error');
    vi.mocked(API.getProjects).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useProjects());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('useProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches single project successfully', async () => {
    const mockProject = createProjectDetail({ name: 'Test Project' });
    vi.mocked(API.getProject).mockResolvedValue(mockProject);

    const { result } = renderHookWithClient(() => useProject('project-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getProject).toHaveBeenCalledWith('project-1');
    expect(result.current.data).toEqual(mockProject);
  });

  it('does not fetch when projectId is empty', () => {
    vi.mocked(API.getProject).mockResolvedValue(createProjectDetail());

    const { result } = renderHookWithClient(() => useProject(''));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getProject).not.toHaveBeenCalled();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Project not found');
    vi.mocked(API.getProject).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useProject('invalid-id'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('useProjectStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches project stats successfully', async () => {
    const mockStats = createProjectStats({ projectId: 'project-1', totalWorkNotes: 5 });
    vi.mocked(API.getProjectStats).mockResolvedValue(mockStats);

    const { result } = renderHookWithClient(() => useProjectStats('project-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getProjectStats).toHaveBeenCalledWith('project-1');
    expect(result.current.data).toEqual(mockStats);
  });

  it('does not fetch when projectId is empty', () => {
    vi.mocked(API.getProjectStats).mockResolvedValue(createProjectStats());

    const { result } = renderHookWithClient(() => useProjectStats(''));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getProjectStats).not.toHaveBeenCalled();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Stats fetch failed');
    vi.mocked(API.getProjectStats).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useProjectStats('project-1'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('useProjectTodos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches project todos successfully', async () => {
    const mockTodos: Todo[] = [createTodo({ title: 'Todo 1' }), createTodo({ title: 'Todo 2' })];
    vi.mocked(API.getProjectTodos).mockResolvedValue(mockTodos);

    const { result } = renderHookWithClient(() => useProjectTodos('project-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getProjectTodos).toHaveBeenCalledWith('project-1');
    expect(result.current.data).toEqual(mockTodos);
  });

  it('does not fetch when projectId is empty', () => {
    vi.mocked(API.getProjectTodos).mockResolvedValue([]);

    const { result } = renderHookWithClient(() => useProjectTodos(''));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getProjectTodos).not.toHaveBeenCalled();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Todos fetch failed');
    vi.mocked(API.getProjectTodos).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useProjectTodos('project-1'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

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

describe('useProjectWorkNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches project work notes successfully', async () => {
    const mockWorkNotes: WorkNote[] = [
      createWorkNote({ title: 'Note 1' }),
      createWorkNote({ title: 'Note 2' }),
    ];
    vi.mocked(API.getProjectWorkNotes).mockResolvedValue(mockWorkNotes);

    const { result } = renderHookWithClient(() => useProjectWorkNotes('project-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getProjectWorkNotes).toHaveBeenCalledWith('project-1');
    expect(result.current.data).toEqual(mockWorkNotes);
  });

  it('does not fetch when projectId is empty', () => {
    vi.mocked(API.getProjectWorkNotes).mockResolvedValue([]);

    const { result } = renderHookWithClient(() => useProjectWorkNotes(''));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getProjectWorkNotes).not.toHaveBeenCalled();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Work notes fetch failed');
    vi.mocked(API.getProjectWorkNotes).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useProjectWorkNotes('project-1'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
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

describe('useProjectFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches project files successfully', async () => {
    const mockFiles: ProjectFile[] = [
      createProjectFile({ originalName: 'file1.pdf' }),
      createProjectFile({ originalName: 'file2.docx' }),
    ];
    vi.mocked(API.getProjectFiles).mockResolvedValue(mockFiles);

    const { result } = renderHookWithClient(() => useProjectFiles('project-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getProjectFiles).toHaveBeenCalledWith('project-1');
    expect(result.current.data).toEqual(mockFiles);
  });

  it('does not fetch when projectId is empty', () => {
    vi.mocked(API.getProjectFiles).mockResolvedValue([]);

    const { result } = renderHookWithClient(() => useProjectFiles(''));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getProjectFiles).not.toHaveBeenCalled();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Files fetch failed');
    vi.mocked(API.getProjectFiles).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useProjectFiles('project-1'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
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

describe('error message fallbacks', () => {
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
