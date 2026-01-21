import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createWorkNote, resetFactoryCounter } from '@web/test/factories';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreateWorkNote,
  useDeleteWorkNote,
  useDeleteWorkNoteFile,
  useGoogleDriveStatus,
  useUpdateWorkNote,
  useUploadWorkNoteFile,
  useWorkNoteFiles,
  useWorkNotes,
  useWorkNotesWithStats,
} from '../use-work-notes';

vi.mock('@web/lib/api', () => ({
  API: {
    getWorkNotes: vi.fn(),
    getTodos: vi.fn(),
    createWorkNote: vi.fn(),
    updateWorkNote: vi.fn(),
    deleteWorkNote: vi.fn(),
    getWorkNoteFiles: vi.fn(),
    uploadWorkNoteFile: vi.fn(),
    deleteWorkNoteFile: vi.fn(),
    getGoogleDriveStatus: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useWorkNotes errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Network error');
    vi.mocked(API.getWorkNotes).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useWorkNotes());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('useWorkNotesWithStats errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('returns zero stats when fetching todos fails for a work note', async () => {
    const workNote = createWorkNote({ id: 'work-1' });
    vi.mocked(API.getWorkNotes).mockResolvedValue([workNote]);
    vi.mocked(API.getTodos).mockRejectedValue(new Error('Failed to fetch'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHookWithClient(() => useWorkNotesWithStats());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data?.[0].todoStats).toEqual({
      total: 0,
      completed: 0,
      remaining: 0,
      pending: 0,
    });
    expect(data?.[0].latestTodoDate).toBeNull();
    expect(data?.[0].latestCompletedAt).toBeNull();

    consoleSpy.mockRestore();
  });
});

describe('useWorkNoteFiles errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Failed to fetch files');
    vi.mocked(API.getWorkNoteFiles).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useWorkNoteFiles('work-1'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('useGoogleDriveStatus errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('does not retry on failure', async () => {
    vi.mocked(API.getGoogleDriveStatus).mockRejectedValue(new Error('Auth error'));

    const { result } = renderHookWithClient(() => useGoogleDriveStatus());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(API.getGoogleDriveStatus).toHaveBeenCalledTimes(1);
  });
});

describe('useWorkNote mutation errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('shows error toast on creation failure', async () => {
    const error = new Error('Creation failed');
    vi.mocked(API.createWorkNote).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useCreateWorkNote());

    await act(async () => {
      result.current.mutate({ title: 'New Note', content: 'Test content' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Creation failed',
    });
  });

  it('shows error toast on update failure', async () => {
    const error = new Error('Update failed');
    vi.mocked(API.updateWorkNote).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUpdateWorkNote());

    await act(async () => {
      result.current.mutate({ workId: 'work-1', data: { title: 'Updated Title' } });
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

  it('shows error toast on delete failure', async () => {
    const error = new Error('Delete failed');
    vi.mocked(API.deleteWorkNote).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useDeleteWorkNote());

    await act(async () => {
      result.current.mutate('work-1');
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

  it('shows error toast on upload failure', async () => {
    const error = new Error('Upload failed');
    vi.mocked(API.uploadWorkNoteFile).mockRejectedValue(error);

    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    const { result } = renderHookWithClient(() => useUploadWorkNoteFile());

    await act(async () => {
      result.current.mutate({ workId: 'work-1', file: mockFile });
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

  it('shows error toast on delete file failure', async () => {
    const error = new Error('Delete failed');
    vi.mocked(API.deleteWorkNoteFile).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useDeleteWorkNoteFile());

    await act(async () => {
      result.current.mutate({ workId: 'work-1', fileId: 'file-1' });
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
});
