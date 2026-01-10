import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createWorkNote, createWorkNoteFile, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePDFJob, useSavePDFDraft, useUploadPDF } from '../use-pdf';

vi.mock('@web/lib/api', () => ({
  API: {
    uploadPDF: vi.fn(),
    getPDFJob: vi.fn(),
    createWorkNote: vi.fn(),
    uploadWorkNoteFile: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

type RefetchIntervalOption = false | number | ((query: unknown) => false | number);

function getRefetchInterval(query: unknown): RefetchIntervalOption | undefined {
  const options = (query as { options?: { refetchInterval?: RefetchIntervalOption } })?.options;
  if (!options) {
    return undefined;
  }

  return typeof options.refetchInterval === 'function'
    ? options.refetchInterval(query)
    : options.refetchInterval;
}

describe('useUploadPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a PDF and shows a success toast', async () => {
    const job = {
      jobId: 'job-1',
      status: 'PENDING' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(API.uploadPDF).mockResolvedValue(job);

    const file = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });

    const { result } = renderHookWithClient(() => useUploadPDF());

    await act(async () => {
      result.current.mutate(file);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.uploadPDF).toHaveBeenCalledWith(file);
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: 'PDF 파일이 업로드되었습니다.',
    });
  });

  it('shows an error toast when upload fails', async () => {
    vi.mocked(API.uploadPDF).mockRejectedValue(new Error('Upload failed'));

    const file = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });

    const { result } = renderHookWithClient(() => useUploadPDF());

    await act(async () => {
      result.current.mutate(file);
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
});

describe('usePDFJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refetches periodically when job is pending', async () => {
    const job = {
      jobId: 'job-1',
      status: 'PENDING' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(API.getPDFJob).mockResolvedValue(job);

    const queryClient = createTestQueryClient();

    const { result } = renderHookWithClient(() => usePDFJob('job-1', true), { queryClient });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ queryKey: ['pdf-job', 'job-1'] });
    const interval = getRefetchInterval(query);

    expect(interval).toBe(2000);
  });

  it('does not refetch when job is ready', async () => {
    const job = {
      jobId: 'job-ready',
      status: 'READY' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(API.getPDFJob).mockResolvedValue(job);

    const queryClient = createTestQueryClient();

    const { result } = renderHookWithClient(() => usePDFJob('job-ready', true), { queryClient });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ queryKey: ['pdf-job', 'job-ready'] });
    const interval = getRefetchInterval(query);

    expect(interval).toBe(false);
  });

  it('does not refetch when job is in error state', async () => {
    const job = {
      jobId: 'job-error',
      status: 'ERROR' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(API.getPDFJob).mockResolvedValue(job);

    const queryClient = createTestQueryClient();

    const { result } = renderHookWithClient(() => usePDFJob('job-error', true), { queryClient });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ queryKey: ['pdf-job', 'job-error'] });
    const interval = getRefetchInterval(query);

    expect(interval).toBe(false);
  });
});

describe('useSavePDFDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('creates a work note, attaches a PDF, and invalidates related queries', async () => {
    const workNote = createWorkNote({ id: 'work-1' });
    vi.mocked(API.createWorkNote).mockResolvedValue(workNote);
    vi.mocked(API.uploadWorkNoteFile).mockResolvedValue(createWorkNoteFile({ workId: 'work-1' }));

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useSavePDFDraft(), { queryClient });

    const pdfFile = new File(['pdf'], 'draft.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({
        draft: { title: 'Draft Title', category: '일반', content: 'Draft content' },
        pdfFile,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.createWorkNote).toHaveBeenCalledWith({
      title: 'Draft Title',
      category: '일반',
      content: 'Draft content',
    });
    expect(API.uploadWorkNoteFile).toHaveBeenCalledWith('work-1', pdfFile);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes-with-stats'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-detail', 'work-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-files', 'work-1'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무노트로 저장되었습니다.',
    });
  });

  it('shows a warning toast when PDF attachment fails', async () => {
    const workNote = createWorkNote({ id: 'work-2' });
    vi.mocked(API.createWorkNote).mockResolvedValue(workNote);
    vi.mocked(API.uploadWorkNoteFile).mockRejectedValue(new Error('Attach failed'));

    const { result } = renderHookWithClient(() => useSavePDFDraft());

    const pdfFile = new File(['pdf'], 'draft.pdf', { type: 'application/pdf' });

    await act(async () => {
      result.current.mutate({
        draft: { title: 'Draft Title', category: '일반', content: 'Draft content' },
        pdfFile,
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.uploadWorkNoteFile).toHaveBeenCalledWith('work-2', pdfFile);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '주의',
      description: 'PDF 첨부에 실패했습니다. 업무노트는 생성되었습니다.',
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무노트로 저장되었습니다.',
    });
  });

  it('shows an error toast when creating the work note fails', async () => {
    vi.mocked(API.createWorkNote).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHookWithClient(() => useSavePDFDraft());

    await act(async () => {
      result.current.mutate({
        draft: { title: 'Draft Title', category: '일반', content: 'Draft content' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(API.uploadWorkNoteFile).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Create failed',
    });
  });
});
