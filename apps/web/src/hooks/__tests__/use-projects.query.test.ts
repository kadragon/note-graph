import { waitFor } from '@testing-library/react';
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
import { renderHookWithClient } from '@web/test/setup';
import type { ProjectFile, Todo, WorkNote } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useProject,
  useProjectFiles,
  useProjectStats,
  useProjects,
  useProjectTodos,
  useProjectWorkNotes,
} from '../use-projects';

vi.mock('@web/lib/api', () => ({
  API: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    getProjectStats: vi.fn(),
    getProjectTodos: vi.fn(),
    getProjectWorkNotes: vi.fn(),
    getProjectFiles: vi.fn(),
  },
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
