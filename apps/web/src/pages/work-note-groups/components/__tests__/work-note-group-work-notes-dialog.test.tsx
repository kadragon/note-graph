import userEvent from '@testing-library/user-event';
import { useWorkNoteGroupWorkNotes } from '@web/hooks/use-work-note-groups';
import { createWorkNoteGroup, createWorkNoteGroupWorkNote } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkNoteGroupWorkNotesDialog } from '../work-note-group-work-notes-dialog';

vi.mock('@web/hooks/use-work-note-groups', () => ({
  useWorkNoteGroupWorkNotes: vi.fn(),
}));

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

describe('WorkNoteGroupWorkNotesDialog', () => {
  const mockOnOpenChange = vi.fn();
  const group = createWorkNoteGroup({ groupId: 'grp-1', name: '프로젝트 A' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    render(
      <WorkNoteGroupWorkNotesDialog open={true} onOpenChange={mockOnOpenChange} group={group} />
    );

    expect(screen.getByText('업무노트 목록을 불러오는 중...')).toBeInTheDocument();
  });

  it('shows empty state when no work notes', () => {
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    render(
      <WorkNoteGroupWorkNotesDialog open={true} onOpenChange={mockOnOpenChange} group={group} />
    );

    expect(screen.getByText('연결된 업무노트가 없습니다.')).toBeInTheDocument();
  });

  it('renders work note list with correct links', () => {
    const workNotes = [
      createWorkNoteGroupWorkNote({ workId: 'WORK-1', title: '업무노트 A' }),
      createWorkNoteGroupWorkNote({ workId: 'WORK-2', title: '업무노트 B' }),
    ];
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: false,
      isError: false,
      data: workNotes,
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    render(
      <WorkNoteGroupWorkNotesDialog open={true} onOpenChange={mockOnOpenChange} group={group} />
    );

    const linkA = screen.getByRole('link', { name: '업무노트 A' });
    expect(linkA).toHaveAttribute('href', '/work-notes?id=WORK-1');
    expect(linkA).toHaveAttribute('target', '_blank');

    const linkB = screen.getByRole('link', { name: '업무노트 B' });
    expect(linkB).toHaveAttribute('href', '/work-notes?id=WORK-2');
  });

  it('shows error state with retry button', async () => {
    const refetch = vi.fn();
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch,
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    const user = userEvent.setup();
    render(
      <WorkNoteGroupWorkNotesDialog open={true} onOpenChange={mockOnOpenChange} group={group} />
    );

    expect(screen.getByText('업무노트 목록을 불러오지 못했습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(refetch).toHaveBeenCalled();
  });
});
