import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import {
  createTodo,
  createWorkNoteFile,
  createWorkNoteWithStats,
  resetFactoryCounter,
} from '@web/test/factories';
import { renderHookWithClient } from '@web/test/setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDownloadWorkNote } from '../use-download-work-note';

// Mock the API
vi.mock('@web/lib/api', () => ({
  API: {
    getTodos: vi.fn(),
    downloadWorkNoteFile: vi.fn(),
  },
}));

// Mock the PDF generation
vi.mock('@web/lib/pdf/generate-work-note-pdf', () => ({
  generateWorkNotePDF: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  generatePDFFilename: vi.fn().mockReturnValue('20240615_Test.pdf'),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Store original methods
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalCreateElement = document.createElement.bind(document);
const originalWindowOpen = window.open;

// Mock click tracking
const mockClick = vi.fn();
let createdAnchor: HTMLAnchorElement | null = null;
let mockOpen: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockOpen = vi.fn();
  window.open = mockOpen as unknown as typeof window.open;

  // Mock URL methods
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  URL.revokeObjectURL = vi.fn();

  // Spy on document.createElement to track anchor creation
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'a') {
      createdAnchor = originalCreateElement('a') as HTMLAnchorElement;
      createdAnchor.click = mockClick;
      return createdAnchor;
    }
    return originalCreateElement(tagName);
  });
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  window.open = originalWindowOpen;
  vi.restoreAllMocks();
  createdAnchor = null;
});

describe('useDownloadWorkNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('provides downloadWorkNote function', () => {
    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    expect(result.current.downloadWorkNote).toBeInstanceOf(Function);
  });

  it('sets isDownloading to true while downloading', async () => {
    vi.mocked(API.getTodos).mockResolvedValue([]);
    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test' });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    expect(result.current.isDownloading).toBe(false);

    act(() => {
      void result.current.downloadWorkNote(workNote);
    });

    expect(result.current.isDownloading).toBe(true);

    await waitFor(() => {
      expect(result.current.isDownloading).toBe(false);
    });
  });

  it('downloads PDF with generated filename', async () => {
    const todos = [createTodo({ id: 'todo-1', title: 'Task 1', workNoteId: 'work-1' })];
    vi.mocked(API.getTodos).mockResolvedValue(todos);

    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test Note' });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    await act(async () => {
      await result.current.downloadWorkNote(workNote);
    });

    expect(API.getTodos).toHaveBeenCalledWith('all', undefined, ['work-1']);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('downloads attachments individually after PDF', async () => {
    vi.mocked(API.getTodos).mockResolvedValue([]);
    vi.mocked(API.downloadWorkNoteFile).mockResolvedValue(
      new Blob(['file'], { type: 'application/pdf' })
    );

    const files = [
      createWorkNoteFile({ fileId: 'file-1', originalName: 'doc1.pdf', workId: 'work-1' }),
      createWorkNoteFile({ fileId: 'file-2', originalName: 'doc2.pdf', workId: 'work-1' }),
    ];
    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test', files });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    await act(async () => {
      await result.current.downloadWorkNote(workNote);
    });

    expect(API.downloadWorkNoteFile).toHaveBeenCalledTimes(2);
    expect(API.downloadWorkNoteFile).toHaveBeenCalledWith('work-1', 'file-1');
    expect(API.downloadWorkNoteFile).toHaveBeenCalledWith('work-1', 'file-2');
  });

  it('opens Google Drive attachments in a new tab', async () => {
    vi.mocked(API.getTodos).mockResolvedValue([]);

    const files = [
      createWorkNoteFile({
        fileId: 'file-1',
        originalName: 'drive.pdf',
        workId: 'work-1',
        storageType: 'GDRIVE',
        gdriveWebViewLink: 'https://drive.example/file-1',
        r2Key: undefined,
      }),
    ];
    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test', files });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    await act(async () => {
      await result.current.downloadWorkNote(workNote);
    });

    expect(mockOpen).toHaveBeenCalledWith('https://drive.example/file-1', '_blank');
    expect(API.downloadWorkNoteFile).not.toHaveBeenCalled();
  });

  it('shows success toast after download completes', async () => {
    vi.mocked(API.getTodos).mockResolvedValue([]);
    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test' });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    await act(async () => {
      await result.current.downloadWorkNote(workNote);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '다운로드 완료',
      description: 'PDF가 다운로드되었습니다.',
    });
  });

  it('shows toast with attachment count when files exist', async () => {
    vi.mocked(API.getTodos).mockResolvedValue([]);
    vi.mocked(API.downloadWorkNoteFile).mockResolvedValue(new Blob(['file']));

    const files = [
      createWorkNoteFile({ fileId: 'file-1', originalName: 'doc1.pdf', workId: 'work-1' }),
    ];
    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test', files });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    await act(async () => {
      await result.current.downloadWorkNote(workNote);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '다운로드 완료',
      description: 'PDF와 첨부파일 1개가 다운로드되었습니다.',
    });
  });

  it('shows open message when Google Drive attachments exist', async () => {
    vi.mocked(API.getTodos).mockResolvedValue([]);

    const files = [
      createWorkNoteFile({
        fileId: 'file-1',
        originalName: 'drive.pdf',
        workId: 'work-1',
        storageType: 'GDRIVE',
        gdriveWebViewLink: 'https://drive.example/file-1',
        r2Key: undefined,
      }),
    ];
    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test', files });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    await act(async () => {
      await result.current.downloadWorkNote(workNote);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '다운로드 완료',
      description: 'PDF가 다운로드되고 첨부파일 1개가 열렸습니다.',
    });
  });

  it('shows error toast when download fails', async () => {
    vi.mocked(API.getTodos).mockRejectedValue(new Error('Network error'));
    const workNote = createWorkNoteWithStats({ id: 'work-1', title: 'Test' });

    const { result } = renderHookWithClient(() => useDownloadWorkNote());

    await act(async () => {
      await result.current.downloadWorkNote(workNote);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'PDF 생성에 실패했습니다.',
    });
  });
});
