import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createWorkNote, createWorkNoteFile, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreateWorkNote,
  useDeleteWorkNote,
  useDeleteWorkNoteFile,
  useMigrateWorkNoteFiles,
  useUpdateWorkNote,
  useUploadWorkNoteFile,
} from '../use-work-notes';

vi.mock('@web/lib/api', () => ({
  API: {
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
