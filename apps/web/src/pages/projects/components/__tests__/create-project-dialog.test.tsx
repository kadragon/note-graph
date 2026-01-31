import { createPerson } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateProjectDialog } from '../create-project-dialog';

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ id, children }: { id?: string; children: ReactNode }) => (
    <button type="button" id={id}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@web/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input id={id} type="checkbox" checked={checked} onChange={() => onCheckedChange?.(!checked)} />
  ),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(() => ({ data: [createPerson()] })),
}));

vi.mock('@web/hooks/use-departments', () => ({
  useDepartments: vi.fn(() => ({ data: [] })),
}));

vi.mock('@web/hooks/use-projects', () => ({
  useCreateProject: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

describe('CreateProjectDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('accessibility', () => {
    it('has aria-label on participant search input', () => {
      render(<CreateProjectDialog {...defaultProps} />);

      const searchInput = screen.getByRole('textbox', { name: /참여자 검색/ });
      expect(searchInput).toBeInTheDocument();
    });
  });
});
