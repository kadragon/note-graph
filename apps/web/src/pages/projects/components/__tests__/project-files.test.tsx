import userEvent from '@testing-library/user-event';
import {
  useDeleteProjectFile,
  useMigrateProjectFiles,
  useProjectFiles,
  useUploadProjectFile,
} from '@web/hooks/use-projects';
import { API } from '@web/lib/api';
import { createProjectFile, resetFactoryCounter } from '@web/test/factories';
import { render, screen, within } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectFiles } from '../project-files';

vi.mock('@web/hooks/use-projects', () => ({
  useProjectFiles: vi.fn(),
  useUploadProjectFile: vi.fn(),
  useDeleteProjectFile: vi.fn(),
  useMigrateProjectFiles: vi.fn(),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    downloadProjectFile: vi.fn(),
  },
}));

describe('ProjectFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:mock-url'),
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
    });

    vi.mocked(useUploadProjectFile).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUploadProjectFile>);

    vi.mocked(useDeleteProjectFile).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteProjectFile>);

    vi.mocked(useMigrateProjectFiles).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMigrateProjectFiles>);
  });

  it('renders external-link action for GDRIVE row instead of blob download action', async () => {
    const user = userEvent.setup();

    vi.mocked(useProjectFiles).mockReturnValue({
      data: [
        createProjectFile({
          fileId: 'FILE-GDRIVE-1',
          originalName: 'drive-doc.pdf',
          storageType: 'GDRIVE',
          gdriveWebViewLink: 'https://drive.google.com/file/d/FILE-GDRIVE-1/view',
        }),
      ],
    } as unknown as ReturnType<typeof useProjectFiles>);

    vi.mocked(API.downloadProjectFile).mockResolvedValue(new Blob());
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    render(<ProjectFiles projectId="project-1" />);

    const row = screen.getByRole('row', { name: /drive-doc\.pdf/i });
    expect(within(row).getByRole('button', { name: 'Google Drive에서 열기' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: '파일 다운로드' })).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Google Drive에서 열기' }));

    expect(API.downloadProjectFile).toHaveBeenCalledWith('project-1', 'FILE-GDRIVE-1', {
      storageType: 'GDRIVE',
    });
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('keeps direct blob download action for R2 row', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['r2 content'], { type: 'application/pdf' });

    vi.mocked(useProjectFiles).mockReturnValue({
      data: [
        createProjectFile({
          fileId: 'FILE-R2-1',
          originalName: 'legacy-r2.pdf',
          storageType: 'R2',
        }),
      ],
    } as unknown as ReturnType<typeof useProjectFiles>);

    vi.mocked(API.downloadProjectFile).mockResolvedValue(blob);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    render(<ProjectFiles projectId="project-1" />);

    const row = screen.getByRole('row', { name: /legacy-r2\.pdf/i });
    expect(within(row).getByRole('button', { name: '파일 다운로드' })).toBeInTheDocument();
    expect(
      within(row).queryByRole('button', { name: 'Google Drive에서 열기' })
    ).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: '파일 다운로드' }));

    expect(API.downloadProjectFile).toHaveBeenCalledWith('project-1', 'FILE-R2-1', {
      storageType: 'R2',
    });
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('shows migration button when legacy R2 files exist and triggers migrate flow', async () => {
    const user = userEvent.setup();
    const migrateMutate = vi.fn();

    vi.mocked(useMigrateProjectFiles).mockReturnValue({
      mutate: migrateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useMigrateProjectFiles>);

    vi.mocked(useProjectFiles).mockReturnValue({
      data: [
        createProjectFile({
          fileId: 'FILE-R2-LEGACY',
          originalName: 'legacy-only.pdf',
          storageType: 'R2',
        }),
      ],
    } as unknown as ReturnType<typeof useProjectFiles>);

    render(<ProjectFiles projectId="project-1" />);

    const migrateButton = screen.getByRole('button', { name: 'R2 파일 Google Drive로 옮기기' });
    expect(migrateButton).toBeInTheDocument();

    await user.click(migrateButton);

    expect(migrateMutate).toHaveBeenCalledWith('project-1');
  });
});
