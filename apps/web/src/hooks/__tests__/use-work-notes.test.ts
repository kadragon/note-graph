import { act, waitFor } from '@testing-library/react';
import { TODO_STATUS } from '@web/constants/todo-status';
import { API } from '@web/lib/api';
import {
  createTodo,
  createWorkNote,
  createWorkNoteFile,
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
    createWorkNote: vi.fn(),
    updateWorkNote: vi.fn(),
    deleteWorkNote: vi.fn(),
    getWorkNoteFiles: vi.fn(),
    uploadWorkNoteFile: vi.fn(),
    deleteWorkNoteFile: vi.fn(),
    migrateWorkNoteFiles: vi.fn(),
    getGoogleDriveStatus: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useWorkNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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

    // Create a future date (day after tomorrow)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const todos = [
      createTodo({
        status: TODO_STATUS.IN_PROGRESS,
        waitUntil: futureDate.toISOString(),
        workNoteId: 'work-1',
      }),
      createTodo({ status: TODO_STATUS.IN_PROGRESS, workNoteId: 'work-1' }), // No waitUntil - should be remaining
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

  it('returns zero stats when fetching todos fails for a work note', async () => {
    const workNote = createWorkNote({ id: 'work-1' });
    vi.mocked(API.getWorkNotes).mockResolvedValue([workNote]);
    vi.mocked(API.getTodos).mockRejectedValue(new Error('Failed to fetch'));

    // Suppress console.error for this test
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
});

describe('useCreateWorkNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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

describe('useWorkNoteFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches files for a work note', async () => {
    const mockFiles = [
      createWorkNoteFile({ fileId: 'file-1', originalName: 'file1.pdf' }),
      createWorkNoteFile({ fileId: 'file-2', originalName: 'file2.jpg' }),
    ];
    const response = { files: mockFiles, googleDriveConfigured: true };
    vi.mocked(API.getWorkNoteFiles).mockResolvedValue(response);

    const { result } = renderHookWithClient(() => useWorkNoteFiles('work-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getWorkNoteFiles).toHaveBeenCalledWith('work-1');
    expect(result.current.data).toEqual(response);
  });

  it('returns empty array when workId is null', async () => {
    const { result } = renderHookWithClient(() => useWorkNoteFiles(null));

    // Query should not be enabled
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

describe('useUploadWorkNoteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('uploads file successfully', async () => {
    const uploadedFile = createWorkNoteFile({ fileId: 'new-file', originalName: 'uploaded.pdf' });
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

  it('invalidates work-note-files and work-note-detail queries on success', async () => {
    const uploadedFile = createWorkNoteFile({ fileId: 'new-file' });
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
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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

  it('shows error toast on delete failure', async () => {
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
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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

describe('useGoogleDriveStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches Google Drive status successfully', async () => {
    const mockStatus = {
      connected: true,
      configured: true,
      calendarConnected: false,
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
    const mockStatus = { connected: true, configured: true, calendarConnected: false };
    vi.mocked(API.getGoogleDriveStatus).mockResolvedValue(mockStatus);

    const queryClient = createTestQueryClient();

    const { result } = renderHookWithClient(() => useGoogleDriveStatus(), { queryClient });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify query state reflects successful fetch with caching
    const queryState = queryClient.getQueryState(['google-drive-status']);
    expect(queryState?.isInvalidated).toBe(false);
    expect(queryState?.dataUpdatedAt).toBeGreaterThan(0);

    // isStale=false confirms staleTime is configured and active
    // (React Query doesn't expose staleTime directly on query state)
    expect(result.current.isStale).toBe(false);
  });

  it('does not retry on failure', async () => {
    vi.mocked(API.getGoogleDriveStatus).mockRejectedValue(new Error('Auth error'));

    const { result } = renderHookWithClient(() => useGoogleDriveStatus());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should only be called once (no retries)
    expect(API.getGoogleDriveStatus).toHaveBeenCalledTimes(1);
  });
});
