import { waitFor } from '@testing-library/react';
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
  useGoogleDriveStatus,
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
  },
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
});

describe('useWorkNoteFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

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

    const queryState = queryClient.getQueryState(['google-drive-status']);
    expect(queryState?.isInvalidated).toBe(false);
    expect(queryState?.dataUpdatedAt).toBeGreaterThan(0);

    expect(result.current.isStale).toBe(false);
  });
});
