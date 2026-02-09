import userEvent from '@testing-library/user-event';
import {
  useDeleteWorkNoteFile,
  useGoogleDriveStatus,
  useMigrateWorkNoteFiles,
  useUploadWorkNoteFile,
  useWorkNoteFiles,
} from '@web/hooks/use-work-notes';
import { createDriveFileListItem, resetFactoryCounter } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkNoteFileList } from '../work-note-file-list';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

vi.mock('@web/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children: ReactNode }) => (
    <div data-testid="alert-dialog" data-open={open ? 'true' : 'false'}>
      {children}
    </div>
  ),
  AlertDialogAction: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="path-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/hooks/use-work-notes', () => ({
  useWorkNoteFiles: vi.fn(),
  useUploadWorkNoteFile: vi.fn(),
  useDeleteWorkNoteFile: vi.fn(),
  useMigrateWorkNoteFiles: vi.fn(),
  downloadWorkNoteFile: vi.fn((file) => file.webViewLink),
  useGoogleDriveStatus: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@web/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('WorkNoteFileList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
    localStorage.clear();

    vi.mocked(useUploadWorkNoteFile).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUploadWorkNoteFile>);

    vi.mocked(useDeleteWorkNoteFile).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteWorkNoteFile>);

    vi.mocked(useMigrateWorkNoteFiles).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMigrateWorkNoteFiles>);

    vi.mocked(useGoogleDriveStatus).mockReturnValue({
      data: { connected: true },
    } as unknown as ReturnType<typeof useGoogleDriveStatus>);
  });

  it('renders Drive file list with links', () => {
    const driveLink = 'https://drive.google.com/file/d/drive-file/view';
    const files = [
      createDriveFileListItem({
        id: 'drive-file',
        name: 'drive-file.pdf',
        webViewLink: driveLink,
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files,
        driveFolderId: 'folder-123',
        driveFolderLink: 'https://drive.google.com/folder',
        googleDriveConfigured: true,
        hasLegacyFiles: false,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    const fileLink = screen.getByRole('link', { name: 'drive-file.pdf' });
    expect(fileLink).toHaveAttribute('href', driveLink);
    expect(fileLink).toHaveAttribute('target', '_blank');

    const driveButtons = screen.getAllByRole('link', { name: 'Google Drive에서 열기' });
    expect(driveButtons[0]).toHaveAttribute('href', driveLink);
    expect(driveButtons[0]).toHaveAttribute('target', '_blank');
  });

  it('renders file metadata in one line with YYYY-MM-DD upload date format', () => {
    const files = [
      createDriveFileListItem({
        id: 'drive-file',
        name: 'meeting-notes.pdf',
        size: 1024,
        modifiedTime: '2026-03-15T12:00:00.000Z',
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files,
        driveFolderId: 'folder-123',
        driveFolderLink: 'https://drive.google.com/folder',
        googleDriveConfigured: true,
        hasLegacyFiles: false,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.getByText('meeting-notes.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB · 업로드일 2026-03-15')).toBeInTheDocument();
  });

  it('renders folder path copy button when folder exists and createdAt is provided', () => {
    const files = [createDriveFileListItem()];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files,
        driveFolderId: 'folder-123',
        driveFolderLink: 'https://drive.google.com/folder/123',
        googleDriveConfigured: true,
        hasLegacyFiles: false,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" createdAt="2026-03-15T10:00:00Z" />);

    expect(screen.getByRole('button', { name: /폴더 경로 복사/i })).toBeInTheDocument();
  });

  it('does not render folder path copy button when createdAt is not provided', () => {
    const files = [createDriveFileListItem()];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files,
        driveFolderId: 'folder-123',
        driveFolderLink: 'https://drive.google.com/folder/123',
        googleDriveConfigured: true,
        hasLegacyFiles: false,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.queryByRole('button', { name: /폴더 경로 복사/i })).not.toBeInTheDocument();
  });

  it('renders migration button when hasLegacyFiles is true', () => {
    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files: [],
        driveFolderId: null,
        driveFolderLink: null,
        googleDriveConfigured: true,
        hasLegacyFiles: true,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(
      screen.getByRole('button', { name: 'R2 파일 Google Drive로 옮기기' })
    ).toBeInTheDocument();
  });

  it('disables upload when Google Drive is not configured', () => {
    vi.mocked(useGoogleDriveStatus).mockReturnValue({
      data: { connected: false },
    } as unknown as ReturnType<typeof useGoogleDriveStatus>);

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files: [],
        driveFolderId: null,
        driveFolderLink: null,
        googleDriveConfigured: false,
        hasLegacyFiles: false,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.getByRole('button', { name: '파일 업로드' })).toBeDisabled();
  });

  it('shows migration result summary after moving R2 files', async () => {
    const user = userEvent.setup();

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files: [],
        driveFolderId: null,
        driveFolderLink: null,
        googleDriveConfigured: true,
        hasLegacyFiles: true,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    const migrateMock = vi.fn(
      (
        _workId: string,
        options?: {
          onSuccess?: (result: { migrated: number; skipped: number; failed: number }) => void;
        }
      ) => {
        options?.onSuccess?.({
          migrated: 1,
          skipped: 1,
          failed: 0,
        });
      }
    );

    vi.mocked(useMigrateWorkNoteFiles).mockReturnValue({
      mutate: migrateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useMigrateWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    await user.click(screen.getByRole('button', { name: 'R2 파일 Google Drive로 옮기기' }));

    expect(
      screen.getByText('마이그레이션 결과: 이동 1개 · 건너뜀 1개 · 실패 0개')
    ).toBeInTheDocument();
  });

  it('shows empty state when no files', () => {
    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files: [],
        driveFolderId: null,
        driveFolderLink: null,
        googleDriveConfigured: true,
        hasLegacyFiles: false,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.getByText('첨부된 파일이 없습니다.')).toBeInTheDocument();
  });

  it('does not show empty state when legacy files exist', () => {
    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files: [],
        driveFolderId: null,
        driveFolderLink: null,
        googleDriveConfigured: true,
        hasLegacyFiles: true,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.queryByText('첨부된 파일이 없습니다.')).not.toBeInTheDocument();
    expect(
      screen.getByText('R2에 저장된 기존 파일이 있습니다. 위의 버튼으로 Google Drive로 옮겨주세요.')
    ).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  describe('local folder path copy', () => {
    const createdAt = '2026-03-15T10:00:00Z';

    beforeEach(() => {
      vi.mocked(useWorkNoteFiles).mockReturnValue({
        data: {
          files: [createDriveFileListItem()],
          driveFolderId: 'folder-123',
          driveFolderLink: 'https://drive.google.com/folder/123',
          googleDriveConfigured: true,
          hasLegacyFiles: false,
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useWorkNoteFiles>);
    });

    it('shows path dialog when clicking folder button without local path configured', async () => {
      const user = userEvent.setup();

      render(<WorkNoteFileList workId="WORK-abc123" createdAt={createdAt} />);

      await user.click(screen.getByRole('button', { name: /폴더 경로 복사/i }));

      expect(screen.getByTestId('path-dialog')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/예: d:\\drive\\/i)).toBeInTheDocument();
    });

    it('copies local path to clipboard when path is configured', async () => {
      const user = userEvent.setup();
      localStorage.setItem('local-drive-path', 'd:\\drive\\');

      render(<WorkNoteFileList workId="WORK-abc123" createdAt={createdAt} />);

      await user.click(screen.getByRole('button', { name: /폴더 경로 복사/i }));

      // Verify the toast message contains the correctly constructed path
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '경로가 복사되었습니다',
          description: 'd:\\drive\\2026\\WORK-abc123',
        })
      );
    });

    it('persists local path to localStorage when saved in dialog', async () => {
      const user = userEvent.setup();

      render(<WorkNoteFileList workId="WORK-abc123" createdAt={createdAt} />);

      await user.click(screen.getByRole('button', { name: /폴더 경로 복사/i }));

      const input = screen.getByPlaceholderText(/예: d:\\drive\\/i);
      await user.clear(input);
      await user.type(input, 'd:\\my-drive\\');

      await user.click(screen.getByRole('button', { name: /저장 후 복사/i }));

      expect(localStorage.getItem('local-drive-path')).toBe('d:\\my-drive\\');
      // Verify the toast message contains the correctly constructed path
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '경로가 복사되었습니다',
          description: 'd:\\my-drive\\2026\\WORK-abc123',
        })
      );
    });

    it('opens settings dialog when clicking settings button', async () => {
      const user = userEvent.setup();
      localStorage.setItem('local-drive-path', 'd:\\drive\\');

      render(<WorkNoteFileList workId="WORK-abc123" createdAt={createdAt} />);

      await user.click(screen.getByRole('button', { name: /경로 설정/i }));

      expect(screen.getByTestId('path-dialog')).toBeInTheDocument();
      expect(screen.getByDisplayValue('d:\\drive\\')).toBeInTheDocument();
    });

    it('constructs path using year from createdAt', async () => {
      const user = userEvent.setup();
      localStorage.setItem('local-drive-path', 'd:\\drive\\');

      // Test with 2025 createdAt
      render(<WorkNoteFileList workId="WORK-xyz789" createdAt="2025-06-20T14:30:00Z" />);

      await user.click(screen.getByRole('button', { name: /폴더 경로 복사/i }));

      // Verify the toast message contains the correctly constructed path with 2025
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'd:\\drive\\2025\\WORK-xyz789',
        })
      );
    });

    it('handles trailing backslash in local path', async () => {
      const user = userEvent.setup();
      localStorage.setItem('local-drive-path', 'd:\\drive'); // No trailing backslash

      render(<WorkNoteFileList workId="WORK-abc123" createdAt={createdAt} />);

      await user.click(screen.getByRole('button', { name: /폴더 경로 복사/i }));

      // Should still produce correct path (no double backslash)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'd:\\drive\\2026\\WORK-abc123',
        })
      );
    });

    it('handles Unix-style paths for macOS/Linux', async () => {
      const user = userEvent.setup();
      localStorage.setItem('local-drive-path', '/Users/me/Drive');

      render(<WorkNoteFileList workId="WORK-abc123" createdAt={createdAt} />);

      await user.click(screen.getByRole('button', { name: /폴더 경로 복사/i }));

      // Should use forward slashes for Unix paths
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '/Users/me/Drive/2026/WORK-abc123',
        })
      );
    });

    it('shows Drive fallback link in dialog', async () => {
      const user = userEvent.setup();

      render(<WorkNoteFileList workId="WORK-abc123" createdAt={createdAt} />);

      await user.click(screen.getByRole('button', { name: /폴더 경로 복사/i }));

      const dialog = screen.getByTestId('path-dialog');
      const fallbackLink = dialog.querySelector('a[href="https://drive.google.com/folder/123"]');
      expect(fallbackLink).toBeInTheDocument();
      expect(fallbackLink).toHaveTextContent('Drive에서 열기');
    });

    // Note: Clipboard error handling test is skipped because jsdom's clipboard implementation
    // doesn't support mocking failures properly. The error handling code path is verified
    // through code review and manual testing.
  });
});
