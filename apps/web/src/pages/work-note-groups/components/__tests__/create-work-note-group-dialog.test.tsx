import userEvent from '@testing-library/user-event';
import { useCreateWorkNoteGroup } from '@web/hooks/use-work-note-groups';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateWorkNoteGroupDialog } from '../create-work-note-group-dialog';

vi.mock('@web/hooks/use-work-note-groups', () => ({
  useCreateWorkNoteGroup: vi.fn(),
}));

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

describe('CreateWorkNoteGroupDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the form and calls create mutation', async () => {
    const mutate = vi.fn((_data: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });

    vi.mocked(useCreateWorkNoteGroup).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateWorkNoteGroup>);

    const user = userEvent.setup();
    render(<CreateWorkNoteGroupDialog open={true} onOpenChange={mockOnOpenChange} />);

    await user.type(screen.getByLabelText('업무 그룹'), '신규 그룹');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(mutate).toHaveBeenCalledWith(
      { name: '신규 그룹' },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
