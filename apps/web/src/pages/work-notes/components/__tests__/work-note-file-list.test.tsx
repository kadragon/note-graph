import userEvent from '@testing-library/user-event';
import { STORAGE_KEYS } from '@web/constants/storage';
import {
  useDeleteWorkNoteFile,
  useGoogleDriveStatus,
  useMigrateWorkNoteFiles,
  useUploadWorkNoteFile,
  useWorkNoteFiles,
} from '@web/hooks/use-work-notes';
import { createWorkNoteFile, resetFactoryCounter } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkNoteFileList } from '../work-note-file-list';

// Mock clipboard
const writeTextMock = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: writeTextMock,
  },
  writable: true,
  configurable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

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

// Mock Popover components
vi.mock('@web/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/hooks/use-work-notes', () => ({
  useWorkNoteFiles: vi.fn(),
  useUploadWorkNoteFile: vi.fn(),
  useDeleteWorkNoteFile: vi.fn(),
  useMigrateWorkNoteFiles: vi.fn(),
  downloadWorkNoteFile: vi.fn(),
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
    localStorageMock.clear();

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

  it('renders Google Drive link and button for Drive files', () => {
    const driveLink = 'https://drive.google.com/file/d/drive-file/view';
    const files = [
      createWorkNoteFile({
        storageType: 'GDRIVE',
        gdriveWebViewLink: driveLink,
        originalName: 'drive-file.pdf',
        r2Key: undefined,
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: { files, googleDriveConfigured: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    const fileLink = screen.getByRole('link', { name: 'drive-file.pdf' });
    expect(fileLink).toHaveAttribute('href', driveLink);
    expect(fileLink).toHaveAttribute('target', '_blank');

    const driveButton = screen.getByRole('link', { name: 'Google Drive에서 열기' });
    expect(driveButton).toHaveAttribute('href', driveLink);
    expect(driveButton).toHaveAttribute('target', '_blank');

    expect(screen.getByTestId('drive-icon')).toBeInTheDocument();
  });

  it('renders R2 badge and migration button for legacy R2 files', () => {
    const files = [
      createWorkNoteFile({
        storageType: 'R2',
        originalName: 'legacy.pdf',
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: { files, googleDriveConfigured: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.getByText('Cloudflare R2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'R2 파일 Google Drive로 옮기기' })
    ).toBeInTheDocument();
  });

  it('shows migration result summary after moving R2 files', async () => {
    const user = userEvent.setup();
    const files = [
      createWorkNoteFile({
        storageType: 'R2',
        originalName: 'legacy.pdf',
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: { files, googleDriveConfigured: true },
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

  it('copies local file path with sanitization when local drive path is set', async () => {
    const user = userEvent.setup();
    const files = [
      createWorkNoteFile({
        storageType: 'GDRIVE',
        originalName: 'report/2025.pdf', // contains slash
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: { files, googleDriveConfigured: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    // Setup local storage with a path
    localStorageMock.getItem.mockReturnValue('C:\\Users\\Drive');

    render(<WorkNoteFileList workId="work-1" />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEYS.LOCAL_DRIVE_PATH);

    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    // Click copy button
    await user.click(screen.getByRole('button', { name: '로컬 경로 복사' }));

    // Expected path: C:\Users\Drive\workNote\work-1\report_2025.pdf
    // Note: sanitization replaces / with _
    const expectedPath = 'C:\\Users\\Drive\\workNote\\work-1\\report_2025.pdf';
    expect(writeTextSpy).toHaveBeenCalledWith(expectedPath);
    expect(mockToast).toHaveBeenCalledWith({ description: '로컬 경로가 복사되었습니다.' });
  });

  it('shows "Open locally" button with notegraph:// link when local drive path is set', () => {
    const files = [
      createWorkNoteFile({
        storageType: 'GDRIVE',
        originalName: 'document.pdf',
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: { files, googleDriveConfigured: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    localStorageMock.getItem.mockReturnValue('C:/GoogleDrive');

    render(<WorkNoteFileList workId="work-1" />);

    const openLocallyButton = screen.getByRole('link', { name: '로컬에서 열기' });
    expect(openLocallyButton).toBeInTheDocument();

    // Expected URL: notegraph://open?path=C%3A%2FGoogleDrive%2FworkNote%2Fwork-1%2Fdocument.pdf
    const expectedPath = 'C:/GoogleDrive/workNote/work-1/document.pdf';
    const expectedUrl = `notegraph://open?path=${encodeURIComponent(expectedPath)}`;
    expect(openLocallyButton).toHaveAttribute('href', expectedUrl);
  });

  it('does not show "Open locally" button when local drive path is not set', () => {
    const files = [
      createWorkNoteFile({
        storageType: 'GDRIVE',
        originalName: 'document.pdf',
      }),
    ];

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: { files, googleDriveConfigured: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    localStorageMock.getItem.mockReturnValue(null);

    render(<WorkNoteFileList workId="work-1" />);

    expect(screen.queryByRole('link', { name: '로컬에서 열기' })).not.toBeInTheDocument();
  });

  it('shows protocol handler installation info and download link in settings', () => {
    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: { files: [], googleDriveConfigured: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    // Check for installation instruction text
    expect(screen.getByText(/로컬에서 열기.*사용하려면/)).toBeInTheDocument();

    // Check for download link to GitHub Releases
    const downloadLink = screen.getByRole('link', { name: /다운로드/ });
    expect(downloadLink).toHaveAttribute('href', 'https://github.com/kadragon/note-graph/releases');
    expect(downloadLink).toHaveAttribute('target', '_blank');
  });
});
