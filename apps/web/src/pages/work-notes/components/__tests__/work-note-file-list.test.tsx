import userEvent from '@testing-library/user-event';
import {
  useDeleteWorkNoteFile,
  useMigrateWorkNoteFiles,
  useUploadWorkNoteFile,
  useWorkNoteFiles,
} from '@web/hooks/use-work-notes';
import { createWorkNoteFile, resetFactoryCounter } from '@web/test/factories';
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
  downloadWorkNoteFile: vi.fn(),
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
      data: files,
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
      data: files,
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
      data: files,
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
});
