import userEvent from '@testing-library/user-event';
import { useDeleteWorkNote, useWorkNotesWithStats } from '@web/hooks/use-work-notes';
import { createWorkNoteWithStats, resetFactoryCounter } from '@web/test/factories';
import { render, screen, waitFor, within } from '@web/test/setup';
import type { WorkNoteWithStats } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkNotes from '../work-notes';

vi.mock('@web/hooks/use-work-notes', () => ({
  useWorkNotesWithStats: vi.fn(),
  useDeleteWorkNote: vi.fn(),
}));

vi.mock('../work-notes/components/work-notes-table', () => ({
  WorkNotesTable: ({
    workNotes,
    onDelete,
  }: {
    workNotes: WorkNoteWithStats[];
    onDelete: (workNoteId: string) => void;
  }) => (
    <div data-testid="work-notes-table">
      <div>table-count: {workNotes.length}</div>
      {workNotes.map((note) => (
        <button key={note.id} type="button" onClick={() => onDelete(note.id)}>
          delete-{note.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../work-notes/components/create-work-note-dialog', () => ({
  CreateWorkNoteDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-work-note-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../work-notes/components/create-from-text-dialog', () => ({
  CreateFromTextDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-from-text-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../work-notes/components/create-from-pdf-dialog', () => ({
  CreateFromPDFDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-from-pdf-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../work-notes/components/view-work-note-dialog', () => ({
  ViewWorkNoteDialog: ({ open }: { open: boolean }) => (
    <div data-testid="view-work-note-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

describe('work-notes page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
    vi.mocked(useDeleteWorkNote).mockReturnValue({
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteWorkNote>);
  });

  it('filters work notes into tabs and updates the list on tab change', async () => {
    const workNotes: WorkNoteWithStats[] = [
      createWorkNoteWithStats({
        id: 'work-active-1',
        todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 },
      }),
      createWorkNoteWithStats({
        id: 'work-active-2',
        todoStats: { total: 2, completed: 0, remaining: 2, pending: 0 },
      }),
      createWorkNoteWithStats({
        id: 'work-pending',
        todoStats: { total: 2, completed: 0, remaining: 0, pending: 2 },
      }),
      createWorkNoteWithStats({
        id: 'work-completed',
        todoStats: { total: 1, completed: 1, remaining: 0, pending: 0 },
      }),
    ];

    vi.mocked(useWorkNotesWithStats).mockReturnValue({
      data: workNotes,
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNotesWithStats>);

    const user = userEvent.setup();
    render(<WorkNotes />);

    expect(screen.getByRole('tab', { name: /진행 중 \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /대기중 \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /완료됨 \(1\)/ })).toBeInTheDocument();

    const activePanel = screen.getByRole('tabpanel', { name: /진행 중/ });
    expect(within(activePanel).getByText('table-count: 2')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /대기중 \(1\)/ }));
    const pendingPanel = screen.getByRole('tabpanel', { name: /대기중/ });
    expect(within(pendingPanel).getByText('table-count: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /완료됨 \(1\)/ }));
    const completedPanel = screen.getByRole('tabpanel', { name: /완료됨/ });
    expect(within(completedPanel).getByText('table-count: 1')).toBeInTheDocument();
  });

  it('confirms deletion and calls the delete mutation', async () => {
    const workNotes: WorkNoteWithStats[] = [
      createWorkNoteWithStats({
        id: 'work-delete',
        todoStats: { total: 0, completed: 0, remaining: 0, pending: 0 },
      }),
    ];

    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteWorkNote).mockReturnValue({
      mutateAsync,
    } as unknown as ReturnType<typeof useDeleteWorkNote>);
    vi.mocked(useWorkNotesWithStats).mockReturnValue({
      data: workNotes,
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNotesWithStats>);

    const user = userEvent.setup();
    render(<WorkNotes />);

    const activePanel = screen.getByRole('tabpanel', { name: /진행 중/ });
    await user.click(within(activePanel).getByRole('button', { name: 'delete-work-delete' }));

    expect(screen.getByText('업무노트 삭제')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('work-delete');
    });
  });
});
