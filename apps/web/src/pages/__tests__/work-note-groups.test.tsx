import userEvent from '@testing-library/user-event';
import {
  useDeleteWorkNoteGroup,
  useToggleWorkNoteGroupActive,
  useWorkNoteGroups,
} from '@web/hooks/use-work-note-groups';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkNoteGroups from '../work-note-groups/work-note-groups';

vi.mock('@web/hooks/use-work-note-groups', () => ({
  useWorkNoteGroups: vi.fn(),
  useDeleteWorkNoteGroup: vi.fn(),
  useToggleWorkNoteGroupActive: vi.fn(),
}));

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

vi.mock('../work-note-groups/components/create-work-note-group-dialog', () => ({
  CreateWorkNoteGroupDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-work-note-group-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../work-note-groups/components/edit-work-note-group-dialog', () => ({
  EditWorkNoteGroupDialog: ({ open, group }: { open: boolean; group: unknown }) => (
    <div
      data-testid="edit-work-note-group-dialog"
      data-open={open ? 'true' : 'false'}
      data-group={group ? 'selected' : 'none'}
    />
  ),
}));

describe('work-note-groups page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useToggleWorkNoteGroupActive).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useToggleWorkNoteGroupActive>);
  });

  it('shows empty state when there are no groups', () => {
    vi.mocked(useWorkNoteGroups).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteGroups>);
    vi.mocked(useDeleteWorkNoteGroup).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteWorkNoteGroup>);

    render(<WorkNoteGroups />);

    expect(screen.getByText('등록된 업무 그룹이 없습니다.')).toBeInTheDocument();
  });

  it('opens the create dialog when clicking the add button', async () => {
    vi.mocked(useWorkNoteGroups).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteGroups>);
    vi.mocked(useDeleteWorkNoteGroup).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteWorkNoteGroup>);

    const user = userEvent.setup();
    render(<WorkNoteGroups />);

    expect(screen.getByTestId('create-work-note-group-dialog')).toHaveAttribute(
      'data-open',
      'false'
    );

    await user.click(screen.getByRole('button', { name: '새 업무 그룹' }));

    expect(screen.getByTestId('create-work-note-group-dialog')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('confirms deletion and calls the delete mutation', async () => {
    const mutate = vi.fn((_id: string, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });

    vi.mocked(useWorkNoteGroups).mockReturnValue({
      data: [
        {
          groupId: 'GRP-1',
          name: '프로젝트 A',
          isActive: true,
          createdAt: '2025-01-01T09:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNoteGroups>);
    vi.mocked(useDeleteWorkNoteGroup).mockReturnValue({
      mutate,
    } as unknown as ReturnType<typeof useDeleteWorkNoteGroup>);

    const user = userEvent.setup();
    render(<WorkNoteGroups />);

    expect(screen.getByTestId('alert-dialog')).toHaveAttribute('data-open', 'false');

    const row = screen.getByText('프로젝트 A').closest('tr');
    expect(row).not.toBeNull();

    const actionButtons = row ? row.querySelectorAll('button') : [];
    expect(actionButtons.length).toBeGreaterThanOrEqual(2);

    // Click delete button (second action button)
    await user.click(actionButtons[1]);

    expect(screen.getByTestId('alert-dialog')).toHaveAttribute('data-open', 'true');

    await user.click(screen.getByRole('button', { name: '삭제' }));

    expect(mutate).toHaveBeenCalledWith(
      'GRP-1',
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(screen.getByTestId('alert-dialog')).toHaveAttribute('data-open', 'false');
  });
});
