import { act, waitFor } from '@testing-library/react';
import { TODO_STATUS } from '@web/constants/todo-status';
import { API } from '@web/lib/api';
import {
  createDriveFileListItem,
  createTodo,
  createWorkNote,
  resetFactoryCounter,
} from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreateWorkNote,
  useDeleteWorkNote,
  useDeleteWorkNoteFile,
  useGoogleDriveStatus,
  useMigrateWorkNoteFiles,
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
    getWorkNoteFiles: vi.fn(),
    getGoogleDriveStatus: vi.fn(),
    createWorkNote: vi.fn(),
    updateWorkNote: vi.fn(),
    deleteWorkNote: vi.fn(),
    uploadWorkNoteFile: vi.fn(),
    deleteWorkNoteFile: vi.fn(),
    migrateWorkNoteFiles: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetFactoryCounter();
});

// --- Query hooks ---

describe('useWorkNotes', () => {
  it('fetches work notes successfully', async () => {
    const mockWorkNotes = [
      createWorkNote({ title: 'Work Note 1' }),
      createWorkNote({ title: 'Work Note 2' }),
    ];
    vi.mocked(API.getWorkNotes).mockResolvedValue(mockWorkNotes);

    const { result } = renderHookWithClient(() => useWorkNotes());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getWorkNotes).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockWorkNotes);
  });

  it('returns loading state initially', () => {
    vi.mocked(API.getWorkNotes).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHookWithClient(() => useWorkNotes());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
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

describe('useWorkNotesWithStats', () => {
  it('fetches work notes with calculated todo stats', async () => {
    const workNote = createWorkNote({ id: 'work-1', title: 'Work Note 1' });
    vi.mocked(API.getWorkNotes).mockResolvedValue([workNote]);

    const now = new Date();
    const todos = [
      createTodo({
        status: TODO_STATUS.COMPLETED,
        updatedAt: now.toISOString(),
        workNoteId: 'work-1',
      }),
      createTodo({
        status: TODO_STATUS.COMPLETED,
        updatedAt: new Date(now.getTime() - 3600000).toISOString(),
        workNoteId: 'work-1',
      }),
      createTodo({ status: TODO_STATUS.IN_PROGRESS, workNoteId: 'work-1' }),
    ];
    vi.mocked(API.getTodos).mockResolvedValue(todos);

    const { result } = renderHookWithClient(() => useWorkNotesWithStats());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getWorkNotes).toHaveBeenCalled();
    expect(API.getTodos).toHaveBeenCalledWith('all', undefined, ['work-1']);

    const data = result.current.data;
    expect(data).toHaveLength(1);
    expect(data?.[0].todoStats).toEqual({
      total: 3,
      completed: 2,
      remaining: 1,
      pending: 0,
    });
    expect(data?.[0].latestCompletedAt).toBe(now.toISOString());
  });

  it('calculates pending count for todos with future waitUntil', async () => {
    const workNote = createWorkNote({ id: 'work-1' });
    vi.mocked(API.getWorkNotes).mockResolvedValue([workNote]);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const todos = [
      createTodo({
        status: TODO_STATUS.IN_PROGRESS,
        waitUntil: futureDate.toISOString(),
        workNoteId: 'work-1',
      }),
      createTodo({ status: TODO_STATUS.IN_PROGRESS, workNoteId: 'work-1' }),
      createTodo({ status: TODO_STATUS.COMPLETED, workNoteId: 'work-1' }),
    ];
    vi.mocked(API.getTodos).mockResolvedValue(todos);

    const { result } = renderHookWithClient(() => useWorkNotesWithStats());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data?.[0].todoStats).toEqual({
      total: 3,
      completed: 1,
      remaining: 1,
      pending: 1,
    });
  });

  it('fetches todos for multiple work notes in a single batch call', async () => {
    const workNotes = [
      createWorkNote({ id: 'work-1', title: 'Work Note 1' }),
      createWorkNote({ id: 'work-2', title: 'Work Note 2' }),
    ];
    vi.mocked(API.getWorkNotes).mockResolvedValue(workNotes);

    vi.mocked(API.getTodos).mockResolvedValue([
      createTodo({ status: TODO_STATUS.COMPLETED, workNoteId: 'work-1' }),
      createTodo({ status: TODO_STATUS.IN_PROGRESS, workNoteId: 'work-2' }),
      createTodo({ status: TODO_STATUS.IN_PROGRESS, workNoteId: 'work-2' }),
    ]);

    const { result } = renderHookWithClient(() => useWorkNotesWithStats());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getTodos).toHaveBeenCalledTimes(1);
    expect(API.getTodos).toHaveBeenCalledWith('all', undefined, ['work-1', 'work-2']);

    const data = result.current.data;
    expect(data?.[0].todoStats.completed).toBe(1);
    expect(data?.[1].todoStats.remaining).toBe(2);
  });

  it('excludes 보류 and 중단 status todos from remaining count', async () => {
    const workNote = createWorkNote({ id: 'work-1' });
    vi.mocked(API.getWorkNotes).mockResolvedValue([workNote]);

    const todos = [
      createTodo({ status: TODO_STATUS.IN_PROGRESS, workNoteId: 'work-1' }),
      createTodo({ status: TODO_STATUS.ON_HOLD, workNoteId: 'work-1' }),
      createTodo({ status: TODO_STATUS.STOPPED, workNoteId: 'work-1' }),
      createTodo({ status: TODO_STATUS.COMPLETED, workNoteId: 'work-1' }),
    ];
    vi.mocked(API.getTodos).mockResolvedValue(todos);

    const { result } = renderHookWithClient(() => useWorkNotesWithStats());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    // 보류/중단 should NOT be counted in remaining or pending
    expect(data?.[0].todoStats).toEqual({
      total: 4,
      completed: 1,
      remaining: 1, // Only 진행중
      pending: 0,
    });
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

describe('useWorkNoteFiles', () => {
  it('fetches files for a work note', async () => {
    const mockFiles = [
      createDriveFileListItem({ id: 'file-1', name: 'file1.pdf' }),
      createDriveFileListItem({ id: 'file-2', name: 'file2.jpg' }),
    ];
    const response = {
      files: mockFiles,
      driveFolderId: 'folder-1',
      driveFolderLink: 'https://drive.google.com/folder',
      googleDriveConfigured: true,
      hasLegacyFiles: false,
    };
    vi.mocked(API.getWorkNoteFiles).mockResolvedValue(response);

    const { result } = renderHookWithClient(() => useWorkNoteFiles('work-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getWorkNoteFiles).toHaveBeenCalledWith('work-1');
    expect(result.current.data).toEqual(response);
  });

  it('returns empty array when workId is null', () => {
    const { result } = renderHookWithClient(() => useWorkNoteFiles(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getWorkNoteFiles).not.toHaveBeenCalled();
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

describe('useGoogleDriveStatus', () => {
  it('fetches Google Drive status successfully', async () => {
    const mockStatus = {
      connected: true,
      configured: true,
      connectedAt: '2026-01-15T10:00:00Z',
    };
    vi.mocked(API.getGoogleDriveStatus).mockResolvedValue(mockStatus);

    const { result } = renderHookWithClient(() => useGoogleDriveStatus());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getGoogleDriveStatus).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockStatus);
  });

  it('has staleTime configured for caching', async () => {
    const mockStatus = { connected: true, configured: true };
    vi.mocked(API.getGoogleDriveStatus).mockResolvedValue(mockStatus);

    const queryClient = createTestQueryClient();

    const { result } = renderHookWithClient(() => useGoogleDriveStatus(), { queryClient });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const queryState = queryClient.getQueryState(['google-drive-status']);
    expect(queryState?.isInvalidated).toBe(false);
    expect(queryState?.dataUpdatedAt).toBeGreaterThan(0);

    expect(result.current.isStale).toBe(false);
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

// --- Mutation hooks ---

describe('useCreateWorkNote', () => {
  it('creates work note successfully', async () => {
    const newWorkNote = createWorkNote({ title: 'New Note' });
    vi.mocked(API.createWorkNote).mockResolvedValue(newWorkNote);

    const { result } = renderHookWithClient(() => useCreateWorkNote());

    await act(async () => {
      result.current.mutate({ title: 'New Note', content: 'Test content' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.createWorkNote).toHaveBeenCalledWith({ title: 'New Note', content: 'Test content' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무노트가 생성되었습니다.',
    });
  });

  it('invalidates work-notes queries on success', async () => {
    const newWorkNote = createWorkNote({ title: 'New Note' });
    vi.mocked(API.createWorkNote).mockResolvedValue(newWorkNote);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useCreateWorkNote(), { queryClient });

    await act(async () => {
      result.current.mutate({ title: 'New Note', content: 'Test content' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes-with-stats'] });
  });
});

describe('useUpdateWorkNote', () => {
  it('updates work note successfully', async () => {
    const updatedWorkNote = createWorkNote({ id: 'work-1', title: 'Updated Title' });
    vi.mocked(API.updateWorkNote).mockResolvedValue(updatedWorkNote);

    const { result } = renderHookWithClient(() => useUpdateWorkNote());

    await act(async () => {
      result.current.mutate({ workId: 'work-1', data: { title: 'Updated Title' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateWorkNote).toHaveBeenCalledWith('work-1', { title: 'Updated Title' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무노트가 수정되었습니다.',
    });
  });

  it('invalidates work-notes and work-note-detail queries on success', async () => {
    const updatedWorkNote = createWorkNote({ id: 'work-1' });
    vi.mocked(API.updateWorkNote).mockResolvedValue(updatedWorkNote);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdateWorkNote(), { queryClient });

    await act(async () => {
      result.current.mutate({ workId: 'work-1', data: { title: 'Updated Title' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes-with-stats'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-detail', 'work-1'] });
  });
});

describe('useDeleteWorkNote', () => {
  it('deletes work note successfully', async () => {
    vi.mocked(API.deleteWorkNote).mockResolvedValue(undefined);

    const { result } = renderHookWithClient(() => useDeleteWorkNote());

    await act(async () => {
      result.current.mutate('work-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.deleteWorkNote).toHaveBeenCalledWith('work-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무노트가 삭제되었습니다.',
    });
  });

  it('invalidates work-notes queries on success', async () => {
    vi.mocked(API.deleteWorkNote).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useDeleteWorkNote(), { queryClient });

    await act(async () => {
      result.current.mutate('work-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes-with-stats'] });
  });
});

describe('useUploadWorkNoteFile', () => {
  it('uploads file successfully', async () => {
    const uploadedFile = createDriveFileListItem({ id: 'new-file', name: 'uploaded.pdf' });
    vi.mocked(API.uploadWorkNoteFile).mockResolvedValue(uploadedFile);

    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    const { result } = renderHookWithClient(() => useUploadWorkNoteFile());

    await act(async () => {
      result.current.mutate({ workId: 'work-1', file: mockFile });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.uploadWorkNoteFile).toHaveBeenCalledWith('work-1', mockFile);
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '파일이 업로드되었습니다.',
    });
  });

  it('invalidates work-note-files and work-note-detail queries on success', async () => {
    const uploadedFile = createDriveFileListItem({ id: 'new-file' });
    vi.mocked(API.uploadWorkNoteFile).mockResolvedValue(uploadedFile);

    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUploadWorkNoteFile(), { queryClient });

    await act(async () => {
      result.current.mutate({ workId: 'work-1', file: mockFile });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-files', 'work-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-detail', 'work-1'] });
  });
});

describe('useDeleteWorkNoteFile', () => {
  it('deletes file successfully', async () => {
    vi.mocked(API.deleteWorkNoteFile).mockResolvedValue(undefined);

    const { result } = renderHookWithClient(() => useDeleteWorkNoteFile());

    await act(async () => {
      result.current.mutate({ workId: 'work-1', fileId: 'file-1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.deleteWorkNoteFile).toHaveBeenCalledWith('work-1', 'file-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '파일이 삭제되었습니다.',
    });
  });

  it('invalidates work-note-files and work-note-detail queries on success', async () => {
    vi.mocked(API.deleteWorkNoteFile).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useDeleteWorkNoteFile(), { queryClient });

    await act(async () => {
      result.current.mutate({ workId: 'work-1', fileId: 'file-1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-files', 'work-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-detail', 'work-1'] });
  });
});

describe('useMigrateWorkNoteFiles', () => {
  it('migrates R2 files successfully', async () => {
    vi.mocked(API.migrateWorkNoteFiles).mockResolvedValue({
      migrated: 2,
      skipped: 0,
      failed: 0,
    });

    const { result } = renderHookWithClient(() => useMigrateWorkNoteFiles());

    await act(async () => {
      result.current.mutate('work-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.migrateWorkNoteFiles).toHaveBeenCalledWith('work-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '마이그레이션 완료: 이동 2개 · 건너뜀 0개 · 실패 0개',
    });
  });
});

describe('Mutation error toast', () => {
  it('shows error toast with custom message on createWorkNote failure', async () => {
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

  it('shows default error message when error has no message', async () => {
    const error = new Error();
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
      description: '업무노트를 생성할 수 없습니다.',
    });
  });
});
