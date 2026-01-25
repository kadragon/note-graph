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

  it('renders Drive folder button when folder exists', () => {
    const files = [createDriveFileListItem()];
    const folderLink = 'https://drive.google.com/folder/123';

    vi.mocked(useWorkNoteFiles).mockReturnValue({
      data: {
        files,
        driveFolderId: 'folder-123',
        driveFolderLink: folderLink,
        googleDriveConfigured: true,
        hasLegacyFiles: false,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteFiles>);

    render(<WorkNoteFileList workId="work-1" />);

    const folderButton = screen.getByRole('link', { name: /Drive 폴더 열기/i });
    expect(folderButton).toHaveAttribute('href', folderLink);
    expect(folderButton).toHaveAttribute('target', '_blank');
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
});
